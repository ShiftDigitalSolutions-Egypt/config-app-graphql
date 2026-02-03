import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  QrCode,
  QrCodeDocument,
  QrCodeTypeGenerator,
  ProductData,
  QrCodeKind,
} from "../models/qr-code.entity";
import { Product, ProductDocument } from "../models/product.entity";
import {
  SessionMessage,
  SessionMessageDocument,
} from "./entities/session-message.schema";
import { Session, SessionDocument } from "./entities/session.schema";
import { PubSubService } from "./pubsub.service";
import { ProcessAggregationMessageInput } from "./dto/package-aggregation.input";
import {
  MessageStatus,
  SessionStatus,
  SessionMode,
  SessionEventKind,
  ChannelStatus,
} from "../common/enums";
import { PackageAggregationEvent } from "./session.types";
import { startAggregationInput } from "./dto/package-aggregation.input";
import { PackageUpdatePublisher, QrConfigurationPublisher } from "@/rabbitmq";
import { Channel, ChannelDocument } from "./entities/channel.schema";

@Injectable()
export class PackageAggregationService {
  private readonly logger = new Logger(PackageAggregationService.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(SessionMessage.name)
    private sessionMessageModel: Model<SessionMessageDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    private readonly pubSubService: PubSubService,
    private readonly packageUpdatePublisher: PackageUpdatePublisher,
    private readonly qrConfigurationPublisher: QrConfigurationPublisher,
  ) {}

  /**
   * Process package aggregation message with validation only (Phase 1)
   */
  async processAggregationMessage(
    input: ProcessAggregationMessageInput,
  ): Promise<SessionMessage> {
    this.logger.log(
      `Processing aggregation message for session ${input.sessionId} (Validation Phase)`,
    );

    // Validate session exists and is in correct state
    const session = await this.validateSession(input.sessionId);

    // Create initial message with processing status
    let message = await this.createInitialMessage(input, session);

    try {
      // Phase 1: Validation - route to appropriate validation function based on session mode
      let validationResult;
      if (session.sessionMode === SessionMode.AGGREGATION) {
        validationResult = await this.validateProcessedQrCodeForAggregation(
          input,
          session,
        );
      } else if (session.sessionMode === SessionMode.SCANNER) {
        validationResult = await this.validateScannerMode(input, session);
      } else {
        throw new Error(`Unsupported session mode: ${session.sessionMode}`);
      }

      if (!validationResult.isValid) {
        await this.updateMessageStatus(
          message._id,
          validationResult.status,
          validationResult.errorMessage,
          input.childQrCode,
        );
        await this.publishAggregationEvent(
          input.sessionId,
          message._id.toString(),
          "ERROR",
          null,
          validationResult.errorMessage,
          validationResult.status,
        );
        // Refresh message from DB to get latest status
        message = await this.sessionMessageModel
          .findById(message._id)
          .populate("sessionId")
          .exec();

        return message;
      }

      // Update message with validation success
      await this.updateMessageStatus(
        message._id,
        MessageStatus.VALID,
        null,
        input.childQrCode,
      );
      const updatedSession = await this.addProcessedQrToSession(
        session,
        input.childQrCode,
      );

      // Publish validation completed event
      let eventData = {};

      if (session.sessionMode === SessionMode.AGGREGATION) {
        // Calculate counts from array lengths (array-based cycle detection)
        const outersPerAggregation = updatedSession.outersPerAggregation || 1;
        const totalOuters = (updatedSession.processedQrCodes || []).length;
        const currentOuterInCycle = totalOuters % outersPerAggregation;
        const totalPackages = (updatedSession.processedPackageQrCodes || [])
          .length;

        eventData = {
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
          outersPerAggregation: outersPerAggregation,
          currentOuterInCycle: currentOuterInCycle,
          totalOuters: totalOuters,
          totalPackages: totalPackages,
        };
      } else if (session.sessionMode === SessionMode.SCANNER) {
        eventData = {
          qrCode: validationResult.qrEntity?.value,
          product: validationResult.product?._id,
          configurationStatus: validationResult.status,
          message: validationResult.message,
        };
      } else {
        eventData = {
          targetQr: session.targetQrCode,
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
        };
      }
      await this.publishAggregationEvent(
        input.sessionId,
        message._id.toString(),
        "VALIDATION_COMPLETED",
        eventData,
        null,
        MessageStatus.VALID,
      );

      this.logger.log(
        `Successfully validated aggregation for QR: ${session.targetQrCode}`,
      );
      return await this.sessionMessageModel
        .findById(message._id)
        .populate("sessionId")
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to process aggregation message: ${error.message}`,
        error.stack,
      );
      await this.updateMessageStatus(
        message._id,
        MessageStatus.ERROR,
        error.message,
      );
      await this.publishAggregationEvent(
        input.sessionId,
        message._id.toString(),
        "ERROR",
        null,
        error.message,
        MessageStatus.ERROR,
      );
      throw error;
    }
  }

  /**
   * Validate session state and permissions
   */
  private async validateSession(sessionId: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId).exec();
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    if (
      session.status === SessionStatus.CLOSED ||
      session.status === SessionStatus.FINALIZED
    ) {
      throw new Error(
        `Session is ${session.status.toLowerCase()} and cannot accept new messages`,
      );
    }

    return session;
  }

  /**
   * Create initial message with processing status
   */
  private async createInitialMessage(
    input: ProcessAggregationMessageInput,
    session: SessionDocument,
  ): Promise<SessionMessage> {
    let messageContent: string;

    if (session.sessionMode === SessionMode.AGGREGATION) {
      // Calculate cycle state from array lengths (new logic)
      const outersPerAggregation = session.outersPerAggregation || 1;
      const totalOuters = (session.processedQrCodes || []).length;
      const totalPackages = (session.processedPackageQrCodes || []).length;
      const currentOuterInCycle = totalOuters % outersPerAggregation;

      // Expecting package if outer count is a non-zero multiple of outersPerAggregation AND no package scanned for this cycle
      const completedCycles = Math.floor(totalOuters / outersPerAggregation);
      const isExpectingPackage =
        totalOuters > 0 &&
        totalOuters % outersPerAggregation === 0 &&
        completedCycles > totalPackages;
      const qrType = isExpectingPackage ? session.aggregationType : "Outer";

      messageContent = `Package aggregation: [${currentOuterInCycle}/${outersPerAggregation} outers in cycle, ${totalPackages} packages completed] -> Current QR: ${input.childQrCode} (expected: ${qrType})`;
    } else if (session.sessionMode === SessionMode.SCANNER) {
      messageContent = `SCANNER mode: Validating QR code ${input.childQrCode} for real-time configuration`;
    } else {
      messageContent = `Aggregation: ${session.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    }

    const message = new this.sessionMessageModel({
      content: messageContent,
      author: input.author,
      sessionId: input.sessionId,
      status: MessageStatus.PROCESSING,
      proccessedQrCode: input.childQrCode
        ? input.childQrCode
        : session.targetQrCode,
      aggregationData: {
        targetQr: session.targetQrCode,
        childQrCode: input.childQrCode,
        eventType: input.eventType,
        metadata: input.metadata,
      },
    });

    return await message.save();
  }

  /**
   * Phase 1: Validation of OUTER QR codes for package aggregation
   *
   * Cycle Detection Logic (based on array lengths):
   * - completedCycles = floor(outerCount / outersPerAggregation)
   * - isExpectingPackage = outerCount > 0 && outerCount % outersPerAggregation === 0 && completedCycles > packageCount
   *
   * Examples (outersPerAggregation = 20):
   * - outerCount = 0, packageCount = 0: expect outer (starting)
   * - outerCount = 19, packageCount = 0: expect outer
   * - outerCount = 20, packageCount = 0: expect package (1st cycle complete, no package yet)
   * - outerCount = 20, packageCount = 1: expect outer (1st cycle has its package)
   * - outerCount = 40, packageCount = 1: expect package (2nd cycle complete, only 1 package)
   * - outerCount = 40, packageCount = 2: expect outer (2nd cycle has its package)
   */
  private async validateProcessedQrCodeForAggregation(
    input: ProcessAggregationMessageInput,
    session: SessionDocument,
  ) {
    // Check for duplicate in session - check both outer QRs and package QRs arrays
    const processedOuters = session.processedQrCodes || [];
    const processedPackages = session.processedPackageQrCodes || [];

    if (
      processedOuters.includes(input.childQrCode) ||
      processedPackages.includes(input.childQrCode)
    ) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.childQrCode} has already been processed in this session`,
      };
    }

    // ============ LIMIT VALIDATION SAFEGUARD ============
    // Prevent adding new QRs once aggregation limits are met ( session is ready to finalize)
    const outersPerAggregation = session.outersPerAggregation || 1;
    const totalOuterCount = processedOuters.length;
    const totalPackageCount = processedPackages.length;
    const completedCycles = Math.floor(totalOuterCount / outersPerAggregation);
    const remainingOuters = totalOuterCount % outersPerAggregation;

    // Session is "complete" when:
    // 1. All cycles are complete (remainingOuters === 0)
    // 2. All expected packages have been scanned (completedCycles === totalPackageCount)
    // 3. At least one cycle has been completed (totalOuterCount > 0)
    const allCyclesComplete =
      totalOuterCount > 0 &&
      remainingOuters === 0 &&
      completedCycles === totalPackageCount;

    if (session.aggregationType === "FULL") {
      // For FULL aggregation, also check if packagesPerPallet limit is reached
      const packagesPerPallet = session.packagesPerPallet || 1;
      if (allCyclesComplete && totalPackageCount >= packagesPerPallet) {
        return {
          isValid: false,
          status: MessageStatus.LIMIT_REACHED,
          errorMessage: `Aggregation limits reached: ${totalOuterCount} outers and ${totalPackageCount}/${packagesPerPallet} packages processed. Session is ready to finalize.`,
        };
      }
    } else {
      // For PACKAGE/PALLET aggregation, block if all cycles are complete
      // This allows the user to finalize immediately without adding more data
      // Note: We only block if there's at least one complete cycle to avoid blocking empty sessions
      if (allCyclesComplete && totalPackageCount > 0) {
        return {
          isValid: false,
          status: MessageStatus.LIMIT_REACHED,
          errorMessage: `Aggregation cycle complete: ${totalOuterCount} outers and ${totalPackageCount} packages processed. Finalize the session or start a new aggregation cycle.`,
        };
      }
    }
    // ============ END LIMIT VALIDATION SAFEGUARD ============

    // check if aggregationType is FULL and targetQr is empty - then first qr must be validated as PALLET
    if (session.aggregationType === "FULL" && !session.targetQrCode) {
      let validationResult = await this.validateTargetPalletForAggregation(
        input.childQrCode,
      );
      if (!validationResult.isValid) {
        return validationResult;
      }
      return {
        isValid: true,
        targetQr: validationResult.targetQr,
        childQr: input.childQrCode,
        isExpectingPackage: false,
      };
    }

    // Check if child QR matches qrCode in session messages and is valid
    const sessionMessages = await this.sessionMessageModel
      .find({
        processedQrCode: input.childQrCode,
        status: MessageStatus.VALID,
      })
      .exec();

    if (sessionMessages.length > 0) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_AGGREGATED,
        errorMessage: `QR code ${input.childQrCode} has already been aggregated before`,
      };
    }

    let childQr: QrCodeDocument | null = null;
    let product: ProductDocument | null = null;

    // Find and validate QR code
    childQr = await this.qrCodeModel
      .findOne({ value: input.childQrCode })
      .exec();
    if (!childQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `QR code '${input.childQrCode}' not found`,
      };
    }

    // Determine expected QR type based on processedQrCodes array length
    // If length is a non-zero multiple of outersPerAggregation AND no package scanned for this cycle => expecting PACKAGE QR
    // Note: totalOuterCount, totalPackageCount, outersPerAggregation, and completedCycles are already calculated in the limit validation safeguard above
    const isExpectingPackage =
      totalOuterCount > 0 &&
      totalOuterCount % outersPerAggregation === 0 &&
      completedCycles > totalPackageCount;

    if (isExpectingPackage) {
      // Expecting PACKAGE QR - validate QR Kind is COMPOSED
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (cycle complete with ${totalOuterCount} outers). QR code '${input.childQrCode}' is not of kind COMPOSED (Package)`,
        };
      }
      // extract qrtype from value field (e.g., PACKAGE, PALLET)
      const valueMatch = childQr.value.match(/-([A-Z]+)-/);
      const extractedType = valueMatch ? valueMatch[1] : null;

      if (
        extractedType !== "PACKAGE" &&
        session.aggregationType === "PACKAGE"
      ) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (cycle complete with ${totalOuterCount} outers). QR code '${input.childQrCode}' is of type '${extractedType}', not 'PACKAGE'`,
        };
      } else if (
        extractedType !== "PALLET" &&
        session.aggregationType === "PALLET"
      ) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PALLET QR (cycle complete with ${totalOuterCount} outers). QR code '${input.childQrCode}' is of type '${extractedType}', not 'PALLET'`,
        };
      }
    } else {
      // Expecting OUTER QR - validate QR type is OUTER
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected OUTER QR (${totalOuterCount % outersPerAggregation}/${outersPerAggregation} outers in current cycle). QR code '${input.childQrCode}' is not of type OUTER`,
        };
      }
    }

    // Validate QR is not already configured
    if (
      childQr.configuredDate ||
      childQr.isConfigured ||
      childQr?.productData.length > 0
    ) {
      return {
        isValid: false,
        status: MessageStatus.IS_CONFIGURED,
        errorMessage: `QR code '${input.childQrCode}' is already configured`,
      };
    }

    return {
      isValid: true,
      childQr,
      product,
      isExpectingPackage, // Pass this to the caller for reference
    };
  }

  /**
   * SCANNER mode: Real-time QR validation and configuration replicating configureOuterQr workflow
   */
  private async validateScannerMode(
    input: ProcessAggregationMessageInput,
    session: SessionDocument,
  ) {
    const qrCode = input.childQrCode;

    // Check for duplicate in session
    if (session.processedQrCodes.includes(qrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${qrCode} has already been processed in this session`,
      };
    }

    try {
      // Find QR code in database - core validation from configureOuterQr
      const qrEntity = await this.qrCodeModel.findOne({ value: qrCode }).exec();
      if (!qrEntity) {
        return {
          isValid: false,
          status: MessageStatus.NOT_FOUND,
          errorMessage: `QR code '${qrCode}' not found`,
        };
      }

      // Validate QR Kind - only OUTER QR codes supported in SCANNER mode
      if (qrEntity.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${qrCode}' is not of kind OUTER for SCANNER mode`,
        };
      }

      // Check if already configured - replicating configureOuterQr validation
      if (qrEntity.configuredDate) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_CONFIGURED,
          errorMessage: `QR code '${qrCode}' is already configured`,
        };
      }

      // Validate product exists and is active
      const product = await this.productModel
        .findById(session.productId)
        .exec();
      if (!product) {
        return {
          isValid: false,
          status: MessageStatus.PRODUCT_NOT_FOUND,
          errorMessage: `Product not found for QR code '${qrCode}'`,
        };
      }

      // Additional product validations can be added here following configureOuterQr patterns

      // If validation passes, trigger QR configuration event via RabbitMQ
      await this.qrConfigurationPublisher.publishQrConfigurationEvent(
        qrCode,
        product._id.toString(),
        session._id.toString(),
        "SCANNER",
        "session-system", // Default author for session operations
      );

      return {
        isValid: true,
        status: MessageStatus.CONFIGURED_SUCCESSFULLY,
        message: `QR code '${qrCode}' validated and configuration event published`,
        qrEntity,
        product,
      };
    } catch (error) {
      this.logger.error(
        `Error validating QR code '${qrCode}': ${error.message}`,
        error.stack,
      );
      return {
        isValid: false,
        status: MessageStatus.VALIDATION_ERROR,
        errorMessage: `Error validating QR code '${qrCode}': ${error.message}`,
      };
    }
  }

  /**
   * Phase 1: Validation of TARGET PALLET QR codes for pallet aggregation
   */
  private async validateTargetPalletForAggregation(targetQrCode: string) {
    // Find and validate target COMPOSED QR code (pallet)
    const targetQr = await this.qrCodeModel
      .findOne({ value: targetQrCode })
      .exec();
    if (!targetQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `PALLET QR code '${targetQrCode}' not found`,
      };
    }

    // Validate QR type is COMPOSED (for pallet)
    if (targetQr.kind !== QrCodeKind.COMPOSED) {
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${targetQrCode}' is not of type COMPOSED (Pallet)`,
      };
    }

    // extract qrtype from value field (e.g., PACKAGE, PALLET)
    const valueMatch = targetQr.value.match(/-([A-Z]+)-/);
    const extractedType = valueMatch ? valueMatch[1] : null;

    if (extractedType !== "PALLET") {
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${targetQrCode}' is of type '${extractedType}', not 'PALLET'`,
      };
    }

    // Validate QR is not yet configured
    if (targetQr.configuredDate) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_CONFIGURED,
        errorMessage: `PALLET QR code '${targetQrCode}' is already configured`,
      };
    }

    // Additional validation for pallet: should not already have pallet aggregation
    if (targetQr.hasPallet) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_CONFIGURED,
        errorMessage: `PALLET QR code '${targetQrCode}' is already configured as a pallet`,
      };
    }

    return { isValid: true, targetQr };
  }

  /**
   * Update message status and error message
   */
  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    errorMessage?: string,
    proccessedQrCode?: string,
  ): Promise<void> {
    const updateData: any = { status };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    if (proccessedQrCode) {
      updateData.proccessedQrCode = proccessedQrCode;
    }
    await this.sessionMessageModel
      .findByIdAndUpdate(messageId, updateData)
      .exec();
  }

  /**
   * Add processed QR code to session with atomic counter updates.
   *
   * IMPORTANT: This method uses atomic MongoDB operations to prevent race conditions
   * when multiple requests are processed concurrently. Event publishing is done
   * asynchronously (fire-and-forget) after the database update to ensure fast response.
   */
  private async addProcessedQrToSession(
    session: SessionDocument,
    qrCode: string,
  ): Promise<SessionDocument> {
    if (session.sessionMode === SessionMode.AGGREGATION) {
      return await this.addProcessedQrForPackageAggregation(session, qrCode);
    }

    // Default: just add to processedQrCodes without counter management
    return await this.sessionModel
      .findByIdAndUpdate(
        session._id,
        { $addToSet: { processedQrCodes: qrCode } },
        { new: true },
      )
      .exec();
  }

  /**
   * Array-based cycle detection for PACKAGE_AGGREGATION mode.
   *
   * NEW LOGIC: Cycle detection is based on processedQrCodes array length, NOT a separate counter.
   * This eliminates race conditions because:
   * 1. $addToSet is atomic and handles duplicates
   * 2. Cycle state is calculated from the actual array length after the update
   * 3. No need to maintain a separate counter that can become stale
   *
   * Cycle Detection Rules:
   * - If processedQrCodes.length % outersPerAggregation === 0 (and length > 0) => cycle complete, expect package
   * - Examples (outersPerAggregation = 20):
   *   - length = 20: 1st cycle complete
   *   - length = 40: 2nd cycle complete
   *   - length = 60: 3rd cycle complete
   *
   * QR Code Separation:
   * - OUTER QRs go to processedQrCodes
   * - PACKAGE QRs go to processedPackageQrCodes
   */
  private async addProcessedQrForPackageAggregation(
    session: SessionDocument,
    qrCode: string,
  ): Promise<SessionDocument> {
    const sessionId = session._id;
    const outersPerAggregation = session.outersPerAggregation || 1;

    let updatedSession: SessionDocument | null = null;
    // if aggregationType is FULL and targetQrCode is empty, first qr must be pallet and put in targetQrCode
    if (session.aggregationType === "FULL" && !session.targetQrCode) {
      updatedSession = await this.sessionModel.findByIdAndUpdate(sessionId, {
        targetQrCode: qrCode,
      });
      if (!updatedSession) {
        throw new Error(`Session ${sessionId} not found during update`);
      }
      return updatedSession;
    }

    // Determine if this is a package QR or outer QR based on current array length
    // This was already validated in validateProcessedQrCodeForPackageAggregation
    const totalOuterCount = (session.processedQrCodes || []).length;
    const totalPackageCount = (session.processedPackageQrCodes || []).length;
    const completedCycles = Math.floor(totalOuterCount / outersPerAggregation);
    const isPackageQr =
      totalOuterCount > 0 &&
      totalOuterCount % outersPerAggregation === 0 &&
      completedCycles > totalPackageCount;

    // Calculate the new package count BEFORE the update (we know if we're adding a package or outer)
    const newPackageCount = isPackageQr
      ? totalPackageCount + 1
      : totalPackageCount;

    // Single atomic update: add QR to the correct array AND update currentAggregationsCount
    updatedSession = await this.sessionModel
      .findByIdAndUpdate(
        sessionId,
        isPackageQr
          ? {
              $addToSet: { processedPackageQrCodes: qrCode },
              $set: { currentAggregationsCount: newPackageCount },
            }
          : {
              $addToSet: { processedQrCodes: qrCode },
            },
        { new: true },
      )
      .exec();

    if (!updatedSession) {
      throw new Error(`Session ${sessionId} not found during update`);
    }

    // Calculate new outer count from updated session for cycle detection
    const newOuterCount = (updatedSession.processedQrCodes || []).length;

    // Detect cycle completion: outer QR was just added and now the count is a multiple of outersPerAggregation
    // This means we just completed a cycle (the NEXT QR should be a package)
    const cycleJustCompleted =
      !isPackageQr &&
      newOuterCount > 0 &&
      newOuterCount % outersPerAggregation === 0;

    if (cycleJustCompleted) {
      this.logger.log(
        `Cycle ${Math.floor(newOuterCount / outersPerAggregation)} completed! ` +
          `Outer count: ${newOuterCount}, expecting package QR next.`,
      );
    }

    // Detect package scan completion: a package QR was just added
    if (isPackageQr) {
      // Fire-and-forget: Publish events asynchronously without blocking the response
      this.publishPackageCycleEventsAsync(
        updatedSession,
        qrCode,
        outersPerAggregation,
      );
    }

    return updatedSession;
  }

  /**
   * Publish package cycle events asynchronously (fire-and-forget).
   * This method does NOT block the main request - events are published in the background.
   * Errors are logged but do not affect the main flow.
   *
   * QR Code Structure (Array-based Cycle Detection):
   * - processedQrCodes: Contains ONLY outer QRs
   * - processedPackageQrCodes: Contains ONLY package QRs
   * - packageQrCode parameter: The package QR that completed this cycle
   *
   * Cycle Calculation:
   * - cycleNumber = processedPackageQrCodes.length (since package was just added)
   * - For cycle N, outers are from index (N-1)*outersPerAggregation to N*outersPerAggregation
   */
  private publishPackageCycleEventsAsync(
    updatedSession: SessionDocument,
    packageQrCode: string,
    outersPerAggregation: number,
  ): void {
    // Use setImmediate to ensure this runs after the current event loop
    setImmediate(async () => {
      try {
        // Get the outers from the UPDATED session's processedQrCodes
        const allOuterQrs = updatedSession.processedQrCodes || [];
        const allPackageQrs = updatedSession.processedPackageQrCodes || [];

        // Cycle number is the count of packages (this package was just added)
        const cycleNumber = allPackageQrs.length;

        // For cycle N, get outers from index (N-1)*outersPerAggregation to N*outersPerAggregation
        // Example: cycle 1 gets outers 0-19, cycle 2 gets outers 20-39, etc.
        const startIndex = (cycleNumber - 1) * outersPerAggregation;
        const endIndex = cycleNumber * outersPerAggregation;
        const packageOuters = allOuterQrs.slice(startIndex, endIndex);

        this.logger.log(
          `Package cycle ${cycleNumber} completed with ${packageOuters.length} outers ` +
            `(indices ${startIndex}-${endIndex - 1}): ${packageOuters.join(", ")} ` +
            `and package: ${packageQrCode}`,
        );

        // Publish GraphQL subscription event
        await this.publishAggregationEvent(
          updatedSession._id.toString(),
          "",
          "PACKAGE_COMPLETION",
          {
            packageQr: packageQrCode,
            outersProcessed: packageOuters,
            cycleNumber: cycleNumber,
          },
          null,
          MessageStatus.VALID,
        );

        // Publish RabbitMQ event with the package QR and its outers
        await this.packageUpdatePublisher.publishPackageCycleEvent(
          updatedSession._id.toString(),
          packageQrCode,
          packageOuters,
          undefined,
          updatedSession.userId,
          {
            triggerSource: "package_reached",
            totalCompleted: cycleNumber,
          },
        );

        this.logger.debug(
          `Package cycle events published successfully for session ${updatedSession._id}`,
        );
      } catch (error) {
        // Log error but don't throw - this is fire-and-forget
        this.logger.error(
          `Failed to publish package cycle events for session ${updatedSession._id}: ${error.message}`,
          error.stack,
        );
      }
    });
  }

  /**
   * Publish aggregation event
   */
  private async publishAggregationEvent(
    sessionId: string,
    messageId: string,
    eventType: PackageAggregationEvent["eventType"],
    data?: any,
    error?: string,
    status?: MessageStatus,
  ): Promise<void> {
    // Serialize complex objects to JSON strings for GraphQL compatibility
    let serializedData: string | undefined;
    if (data !== null && data !== undefined) {
      try {
        serializedData = typeof data === "string" ? data : JSON.stringify(data);
      } catch (serializationError) {
        this.logger.warn(
          `Failed to serialize event data: ${serializationError.message}. Using string representation.`,
        );
        serializedData = String(data);
      }
    }

    const event: PackageAggregationEvent = {
      sessionId: sessionId,
      messageId,
      eventType,
      data: serializedData,
      error,
      status,
    };

    await this.pubSubService.publishPackageAggregationEvent(event);
  }

  /**
   * Finalize session - handles Phase 2 (Configuration), Phase 3 (Relationship Update), and session closure
   * Supports both PACKAGE_AGGREGATION and FULL_AGGREGATION modes
   */
  async finalizeSession(sessionId: string): Promise<Session> {
    const startTime = Date.now();
    this.logger.log(
      `Finalizing session ${sessionId} (Configuration and Relationship Update)`,
    );

    // Validate session exists and is in correct state
    const session = await this.validateSession(sessionId);

    if (session.status !== SessionStatus.OPEN) {
      throw new Error(
        `Session must be in OPEN status to finalize. Current status: ${session.status}`,
      );
    }

    try {
      // Route to appropriate finalization logic based on session mode
      if (session.sessionMode === SessionMode.AGGREGATION) {
        console.log("Session mode is PACKAGE_AGGREGATION");

        return await this.finalizeAggregation(sessionId, session, startTime);
      } else if (session.sessionMode === SessionMode.SCANNER) {
        return await this.finalizeScanner(sessionId, session, startTime);
      } else {
        throw new Error(`Unsupported session mode: ${session.sessionMode}`);
      }
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      this.logger.error(
        `Failed to finalize session after ${executionTime}ms: ${error.message}`,
        error.stack,
      );
      await this.publishAggregationEvent(
        sessionId,
        "",
        "ERROR",
        null,
        error.message,
        MessageStatus.ERROR,
      );
      throw error;
    }
  }

  /**
   * Finalize package aggregation session (array-based logic)
   */
  private async finalizeAggregation(
    sessionId: string,
    session: SessionDocument,
    startTime: number,
  ): Promise<Session> {
    // Calculate cycle state from array lengths (new logic)
    const outersPerAggregation = session.outersPerAggregation || 1;
    const totalOuters = (session.processedQrCodes || []).length;
    const totalPackages = (session.processedPackageQrCodes || []).length;
    const remainingOuters = totalOuters % outersPerAggregation;
    const completedCycles = Math.floor(totalOuters / outersPerAggregation);

    // Prevent finalization if there are unprocessed outers in the current cycle
    if (remainingOuters !== 0) {
      throw new Error(
        `Cannot finalize session: There are still ${remainingOuters} outers remaining in the current cycle (${remainingOuters}/${outersPerAggregation}).`,
      );
    }

    // Validate that all completed outer cycles have their corresponding package/pallet QR scanned
    // This applies to PACKAGE, PALLET, and FULL aggregation types
    if (completedCycles !== totalPackages) {
      const expectedType =
        session.aggregationType === "PALLET" ? "PALLET" : "PACKAGE";
      if (completedCycles > totalPackages) {
        throw new Error(
          `Cannot finalize session: ${completedCycles} outer cycle(s) completed but only ${totalPackages} ${expectedType} QR(s) scanned. ` +
            `Please scan ${completedCycles - totalPackages} more ${expectedType} QR(s) to complete the aggregation.`,
        );
      } else {
        // This shouldn't happen in normal flow, but handle it for safety
        throw new Error(
          `Cannot finalize session: Inconsistent state - ${totalPackages} ${expectedType} QR(s) scanned but only ${completedCycles} outer cycle(s) completed.`,
        );
      }
    }

    // For aggregationType FULL, additionally ensure packagesPerPallet limit is reached
    if (session.aggregationType === "FULL") {
      const packagesPerPallet = session.packagesPerPallet;
      if (packagesPerPallet !== totalPackages) {
        throw new Error(
          `Cannot finalize FULL aggregation session: Expected ${packagesPerPallet} packages for pallet, but only ${totalPackages} packages were processed.`,
        );
      }
    }

    // Update session status to FINALIZED
    const updatedSession = await this.sessionModel
      .findByIdAndUpdate(
        sessionId,
        { status: SessionStatus.FINALIZED },
        { new: true },
      )
      .exec();

    if (!updatedSession) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Close all opened subscriptions related to this session
    await this.pubSubService.closeSessionSubscriptions(sessionId);

    // Use counts already calculated above
    const processedOutersCount = totalOuters;
    const processedPackagesCount = totalPackages;

    // Publish session closed event
    await this.publishAggregationEvent(
      sessionId,
      "",
      "SESSION_CLOSED",
      {
        status: SessionStatus.FINALIZED,
        processedOutersCount: processedOutersCount,
        processedPackagesCount: processedPackagesCount,
      },
      null,
      MessageStatus.VALID,
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized package aggregation session ${sessionId} with ${processedOutersCount} outers and ${processedPackagesCount} packages in ${executionTime}ms`,
    );
    return updatedSession;
  }

  /**
   * Finalize SCANNER mode session (real-time QR configuration tracking)
   */
  private async finalizeScanner(
    sessionId: string,
    session: SessionDocument,
    startTime: number,
  ): Promise<Session> {
    // Get all processed messages for this SCANNER session
    const processedMessages = await this.sessionMessageModel
      .find({
        sessionId: sessionId,
        status: {
          $in: [MessageStatus.VALID, MessageStatus.CONFIGURED_SUCCESSFULLY],
        },
      })
      .exec();

    // Count successful configurations vs validation errors
    const successfulConfigurations = processedMessages.filter(
      (msg) => msg.status === MessageStatus.CONFIGURED_SUCCESSFULLY,
    ).length;

    const validationErrors = await this.sessionMessageModel
      .countDocuments({
        sessionId: sessionId,
        status: {
          $in: [
            MessageStatus.ALREADY_CONFIGURED,
            MessageStatus.NOT_FOUND,
            MessageStatus.WRONG_TYPE,
            MessageStatus.PRODUCT_NOT_FOUND,
            MessageStatus.VALIDATION_ERROR,
            MessageStatus.DUPLICATE_IN_SESSION,
          ],
        },
      })
      .exec();

    // Update session status to FINALIZED
    const updatedSession = await this.sessionModel
      .findByIdAndUpdate(
        sessionId,
        {
          status: SessionStatus.FINALIZED,
          finalizedAt: new Date(),
          // Store session summary in metadata
          metadata: {
            // ...session.metadata,
            scannerSummary: {
              totalScanned: processedMessages.length + validationErrors,
              successfulConfigurations,
              validationErrors,
              sessionDuration: Date.now() - startTime,
              finalizedAt: new Date(),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedSession) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Close all opened subscriptions related to this session
    await this.pubSubService.closeSessionSubscriptions(sessionId);

    // Publish session closed event with SCANNER mode statistics
    await this.publishAggregationEvent(
      sessionId,
      "",
      "SESSION_CLOSED",
      {
        status: SessionStatus.FINALIZED,
        sessionMode: SessionMode.SCANNER,
        totalScanned: processedMessages.length + validationErrors,
        successfulConfigurations,
        validationErrors,
        processedQrCodes: session.processedQrCodes,
      },
      null,
      MessageStatus.VALID,
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized SCANNER mode session ${sessionId} with ${successfulConfigurations}/${processedMessages.length + validationErrors} successful configurations in ${executionTime}ms`,
    );

    return updatedSession;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
  ): Promise<Session> {
    const updatedSession = await this.sessionModel
      .findByIdAndUpdate(sessionId, { status }, { new: true })
      .exec();

    if (!updatedSession) {
      throw new Error(`Session with ID '${sessionId}' not found`);
    }

    // Publish event when session is closed/finalized
    if (status === SessionStatus.CLOSED || status === SessionStatus.FINALIZED) {
      await this.publishAggregationEvent(
        sessionId,
        "",
        "SESSION_CLOSED",
        {
          status,
        },
        null,
        MessageStatus.VALID,
      );
    }

    return updatedSession;
  }

  // Package Aggregation methods
  async startAggregation(input: startAggregationInput): Promise<Session> {
    let validationResult;
    
    // Validate channelId is only provided for DELIVERY_NOTE mode
    if (input.channelId && input.sessionMode !== SessionMode.DELIVERY_NOTE) {
      throw new Error(`channelId should not be provided when sessionMode is not DELIVERY_NOTE`);
    }
    
    const product = await this.productModel.findById(input.productId).exec();
    if (!product) {
      throw new Error(`Product with ID '${input.productId}' not found`);
    }

    if (input.sessionMode === SessionMode.AGGREGATION || input.sessionMode === SessionMode.DELIVERY_NOTE) {
      if (input.aggregationType === "PACKAGE") {
        if (!product.numberOfPacking || product.numberOfPacking <= 0) {
          throw new Error(
            `numberOfPacking must be greater than 0 for PACKAGE_AGGREGATION mode in the current product`,
          );
        }
      } else if (input.aggregationType === "PALLET") {
        if (
          !product.enableUnitPerPallet ||
          product.numberOfUnitPerPallet <= 0
        ) {
          throw new Error(
            `numberOfUnitPerPallet must be greater than 0 for PALLET_AGGREGATION mode in the current product`,
          );
        }
      } else if (input.aggregationType === "FULL") {
        if (
          !product.numberOfPacking ||
          product.numberOfPacking <= 0 ||
          !product.numberOfPallet
        ) {
          throw new Error(
            `For FULL_AGGREGATION mode, numberOfPacking and numberOfPallet must be greater than 0 in the current product`,
          );
        }
      }
    } else if (input.sessionMode === SessionMode.SCANNER) {
      // This mode is used for real-time QR validation and configuration without aggregation
      this.logger.log(
        `Starting SCANNER mode session for product ${product.name} (${product._id})`,
      );
    } else {
      throw new Error(`Unsupported session mode: ${input.sessionMode}`);
    }
    if (validationResult && !validationResult.isValid) {
      throw new Error(validationResult.errorMessage);
    }

    // Create channel if sessionMode is DELIVERY_NOTE
    let channelId: string | undefined;
    if (input.sessionMode === SessionMode.DELIVERY_NOTE) {
      const channelData = {
        name: input.name,
        orderQrCode: null,
        userId: input.userId,
        status: ChannelStatus.ACTIVE,
        startDate: new Date(),
        metadata: {
          createdForSession: input.name,
          productId: input.productId
        }
      };
      
      const createdChannel = new this.channelModel(channelData);
      const savedChannel = await createdChannel.save();
      channelId = savedChannel._id.toString();
      
      this.logger.log(`Created channel ${channelId} for DELIVERY_NOTE session ${input.name}`);
    }

    const sessionData: any = {
      product: {
        id: product?._id,
        productId: product?._id,
        values: product?.values,
        name: product?.name,
        image: product?.image,
        // createdAt: product?.createdAt,
        hasAggregation: true,
        hasOrderNumber: product.orderNumber,
        hasPallet: !!product.numberOfPallet,
        hasPatch: product.patchId,
        hasProductionDate: product.productionDate,
        isGuided: product.palletGuided,
        isPalletAvailable: !!product.numberOfPallet,
        numberOfAggregations: product.numberOfPacking,
        enableUnitPerPallet: product.enableUnitPerPallet,
        numberOfUnitPerPallet: product.numberOfUnitPerPallet,
        numberOfPallet: product.numberOfPallet,
        orderNumber: product.orderNumber,
        patchId: product.patchId,
        expirationDate: product.expirationDate,
      },
      ...input,
      status: SessionStatus.OPEN,
      sessionMode: input.sessionMode,
      targetQrCode: null,
      processedQrCodes: [],
      processedPackageQrCodes: [],
      channelId: channelId,
    };

    if (input.sessionMode === SessionMode.AGGREGATION || input.sessionMode === SessionMode.DELIVERY_NOTE) {
      sessionData.currentAggregationsCount = 0;
      sessionData.aggregationType = input.aggregationType;
      if (input.aggregationType === "PACKAGE") {
        sessionData.outersPerAggregation = product.numberOfPacking;
      } else if (input.aggregationType === "PALLET") {
        sessionData.outersPerAggregation = product.numberOfUnitPerPallet;
      } else if (input.aggregationType === "FULL") {
        sessionData.outersPerAggregation = product.numberOfPacking;
        sessionData.packagesPerPallet = product.numberOfPallet;
      }
    }
    // Add SCANNER specific fields - minimal configuration for real-time scanning
    if (input.sessionMode === SessionMode.SCANNER) {
      // SCANNER mode specific metadata
      sessionData.metadata = {
        ...sessionData.metadata,
        scannerMode: true,
        scannerStartedAt: new Date(),
        expectedProductId: product._id.toString(),
        productName: product.name,
        // No aggregation counters needed as SCANNER mode doesn't aggregate
      };

      // Override aggregation-related product fields for SCANNER mode
      sessionData.product.hasAggregation = false; // SCANNER mode doesn't do aggregation
      sessionData.product.numberOfAggregations = undefined; // Not applicable
      sessionData.product.isPalletAvailable = false; // Not applicable for scanning

      this.logger.log(
        `SCANNER mode configured for product: ${product.name} (${product._id})`,
      );
    }

    const createdSession = new this.sessionModel(sessionData);
    const savedSession = await createdSession.save();

    // Publish session event
    await this.pubSubService.publishSessionEvent(
      {
        id: savedSession._id.toString(),
        _id: savedSession._id.toString(),
        name: savedSession.name,
        description: savedSession.description,
        status: savedSession.status,
        sessionMode: savedSession.sessionMode,
        userId: savedSession.userId,
        processedQrCodes: savedSession.processedQrCodes || [],
        channelId: savedSession.channelId,
        createdAt: savedSession.createdAt,
        updatedAt: savedSession.updatedAt,
      },
      SessionEventKind.CREATED,
    );

    return savedSession;
  }
}
