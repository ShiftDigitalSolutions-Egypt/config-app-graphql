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
import { ExtendedProduct } from "../models/scan.entity";
import {
  ChannelMessage,
  ChannelMessageDocument,
} from "./channel-message.schema";
import { Channel, ChannelDocument } from "./channel.schema";
import { PubSubService } from "./pubsub.service";
import { ProcessAggregationMessageInput } from "./dto/package-aggregation.input";
import {
  MessageStatus,
  ChannelStatus,
  SessionMode,
  ChannelEventKind,
} from "../common/enums";
import { PackageAggregationEvent } from "./channel.types";
import { startAggregationInput } from "./dto/package-aggregation.input";
import { PackageUpdatePublisher, QrConfigurationPublisher } from "@/rabbitmq";
import { ConfigurationHelpers } from "../configuration/configuration.helpers";

@Injectable()
export class PackageAggregationService {
  private readonly logger = new Logger(PackageAggregationService.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(ChannelMessage.name)
    private channelMessageModel: Model<ChannelMessageDocument>,
    private readonly pubSubService: PubSubService,
    private readonly packageUpdatePublisher: PackageUpdatePublisher,
    private readonly qrConfigurationPublisher: QrConfigurationPublisher
  ) {}

  /**
   * Process package aggregation message with validation only (Phase 1)
   */
  async processAggregationMessage(
    input: ProcessAggregationMessageInput
  ): Promise<ChannelMessage> {
    this.logger.log(
      `Processing aggregation message for channel ${input.channelId} (Validation Phase)`
    );

    // Validate channel exists and is in correct state
    const channel = await this.validateChannel(input.channelId);

    // Create initial message with processing status
    let message = await this.createInitialMessage(input, channel);

    try {
      // Phase 1: Validation - route to appropriate validation function based on session mode
      let validationResult;
      if (channel.sessionMode === SessionMode.AGGREGATION) {
        validationResult = await this.validateProcessedQrCodeForAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.SCANNER) {
        validationResult = await this.validateScannerMode(input, channel);
      } else {
        throw new Error(`Unsupported session mode: ${channel.sessionMode}`);
      }

      if (!validationResult.isValid) {
        await this.updateMessageStatus(
          message._id,
          validationResult.status,
          validationResult.errorMessage,
          input.childQrCode
        );
        await this.publishAggregationEvent(
          input.channelId,
          message._id.toString(),
          "ERROR",
          null,
          validationResult.errorMessage,
          validationResult.status
        );
        // Refresh message from DB to get latest status
        message = await this.channelMessageModel
          .findById(message._id)
          .populate("channelId")
          .exec();

        return message;
      }

      // Update message with validation success
      await this.updateMessageStatus(
        message._id,
        MessageStatus.VALID,
        null,
        input.childQrCode
      );
      const updatedChannel = await this.addProcessedQrToChannel(
        channel,
        input.childQrCode
      );

      // Publish validation completed event
      let eventData = {};

      if (channel.sessionMode === SessionMode.AGGREGATION) {
        // Calculate counts from array lengths (array-based cycle detection)
        const outersPerPackage = updatedChannel.outersPerPackage || 1;
        const totalOuters = (updatedChannel.processedQrCodes || []).length;
        const currentOuterInCycle = totalOuters % outersPerPackage;
        const totalPackages = (updatedChannel.processedPackageQrCodes || [])
          .length;

        eventData = {
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
          outersPerPackage: outersPerPackage,
          currentOuterInCycle: currentOuterInCycle,
          totalOuters: totalOuters,
          totalPackages: totalPackages,
        };
      } else if (channel.sessionMode === SessionMode.SCANNER) {
        eventData = {
          qrCode: validationResult.qrEntity?.value,
          product: validationResult.product?._id,
          configurationStatus: validationResult.status,
          message: validationResult.message,
        };
      } else {
        eventData = {
          targetQr: channel.targetQrCode,
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
        };
      }
      await this.publishAggregationEvent(
        input.channelId,
        message._id.toString(),
        "VALIDATION_COMPLETED",
        eventData,
        null,
        MessageStatus.VALID
      );

      this.logger.log(
        `Successfully validated aggregation for QR: ${channel.targetQrCode}`
      );
      return await this.channelMessageModel
        .findById(message._id)
        .populate("channelId")
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to process aggregation message: ${error.message}`,
        error.stack
      );
      await this.updateMessageStatus(
        message._id,
        MessageStatus.ERROR,
        error.message
      );
      await this.publishAggregationEvent(
        input.channelId,
        message._id.toString(),
        "ERROR",
        null,
        error.message,
        MessageStatus.ERROR
      );
      throw error;
    }
  }

  /**
   * Validate channel state and permissions
   */
  private async validateChannel(channelId: string): Promise<ChannelDocument> {
    const channel = await this.channelModel.findById(channelId).exec();
    if (!channel) {
      throw new Error(`Channel with ID '${channelId}' not found`);
    }

    if (
      channel.status === ChannelStatus.CLOSED ||
      channel.status === ChannelStatus.FINALIZED
    ) {
      throw new Error(
        `Channel is ${channel.status.toLowerCase()} and cannot accept new messages`
      );
    }

    return channel;
  }

  /**
   * Create initial message with processing status
   */
  private async createInitialMessage(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ): Promise<ChannelMessage> {
    let messageContent: string;

    if (channel.sessionMode === SessionMode.AGGREGATION) {
      // Calculate cycle state from array lengths (new logic)
      const outersPerPackage = channel.outersPerPackage || 1;
      const totalOuters = (channel.processedQrCodes || []).length;
      const totalPackages = (channel.processedPackageQrCodes || []).length;
      const currentOuterInCycle = totalOuters % outersPerPackage;

      // Expecting package if outer count is a non-zero multiple of outersPerPackage AND no package scanned for this cycle
      const completedCycles = Math.floor(totalOuters / outersPerPackage);
      const isExpectingPackage =
        totalOuters > 0 &&
        totalOuters % outersPerPackage === 0 &&
        completedCycles > totalPackages;
      const qrType = isExpectingPackage ? channel.aggregationType : "Outer";

      messageContent = `Package aggregation: [${currentOuterInCycle}/${outersPerPackage} outers in cycle, ${totalPackages} packages completed] -> Current QR: ${input.childQrCode} (expected: ${qrType})`;
    } else if (channel.sessionMode === SessionMode.SCANNER) {
      messageContent = `SCANNER mode: Validating QR code ${input.childQrCode} for real-time configuration`;
    } else {
      messageContent = `Aggregation: ${channel.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    }

    const message = new this.channelMessageModel({
      content: messageContent,
      author: input.author,
      channelId: input.channelId,
      status: MessageStatus.PROCESSING,
      proccessedQrCode: input.childQrCode
        ? input.childQrCode
        : channel.targetQrCode,
      aggregationData: {
        targetQr: channel.targetQrCode,
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
   * - completedCycles = floor(outerCount / outersPerPackage)
   * - isExpectingPackage = outerCount > 0 && outerCount % outersPerPackage === 0 && completedCycles > packageCount
   *
   * Examples (outersPerPackage = 20):
   * - outerCount = 0, packageCount = 0: expect outer (starting)
   * - outerCount = 19, packageCount = 0: expect outer
   * - outerCount = 20, packageCount = 0: expect package (1st cycle complete, no package yet)
   * - outerCount = 20, packageCount = 1: expect outer (1st cycle has its package)
   * - outerCount = 40, packageCount = 1: expect package (2nd cycle complete, only 1 package)
   * - outerCount = 40, packageCount = 2: expect outer (2nd cycle has its package)
   */
  private async validateProcessedQrCodeForAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session - check both outer QRs and package QRs arrays
    const processedOuters = channel.processedQrCodes || [];
    const processedPackages = channel.processedPackageQrCodes || [];

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

    // Check if child QR matches qrCode in channel messages and is valid
    const channelMessages = await this.channelMessageModel
      .find({
        proccessedQrCode: input.childQrCode,
        status: MessageStatus.VALID,
      })
      .exec();

    if (channelMessages.length > 0) {
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
    // If length is a non-zero multiple of outersPerPackage AND no package scanned for this cycle => expecting PACKAGE QR
    const outerCount = processedOuters.length;
    const packageCount = processedPackages.length;
    const outersPerPackage = channel.outersPerPackage || 1;
    const completedCycles = Math.floor(outerCount / outersPerPackage);
    const isExpectingPackage =
      outerCount > 0 &&
      outerCount % outersPerPackage === 0 &&
      completedCycles > packageCount;

    if (isExpectingPackage) {
      // Expecting PACKAGE QR - validate QR Kind is COMPOSED
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (cycle complete with ${outerCount} outers). QR code '${input.childQrCode}' is not of kind COMPOSED (Package)`,
        };
      }
      // extract qrtype from value field (e.g., PACKAGE, PALLET)
      const valueMatch = childQr.value.match(/-([A-Z]+)-/);
      const extractedType = valueMatch ? valueMatch[1] : null;

      if (
        extractedType !== "PACKAGE" &&
        channel.aggregationType === "PACKAGE"
      ) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (cycle complete with ${outerCount} outers). QR code '${input.childQrCode}' is of type '${extractedType}', not 'PACKAGE'`,
        };
      } else if (
        extractedType !== "PALLET" &&
        channel.aggregationType === "PALLET"
      ) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PALLET QR (cycle complete with ${outerCount} outers). QR code '${input.childQrCode}' is of type '${extractedType}', not 'PALLET'`,
        };
      }
    } else {
      // Expecting OUTER QR - validate QR type is OUTER
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected OUTER QR (${outerCount % outersPerPackage}/${outersPerPackage} outers in current cycle). QR code '${input.childQrCode}' is not of type OUTER`,
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
    channel: ChannelDocument
  ) {
    const qrCode = input.childQrCode;

    // Check for duplicate in session
    if (channel.processedQrCodes.includes(qrCode)) {
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
        .findById(channel.productId)
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
        channel._id.toString(),
        "SCANNER",
        "channel-system" // Default author for channel operations
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
        error.stack
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
   * Phase 2A: Configure package counters and product data
   */
  private async configurePackageCounters(
    targetQr: QrCodeDocument,
    outerQr: QrCodeDocument | null,
    product: ProductDocument | null,
    channel: ChannelDocument
  ) {
    if (!outerQr || !product) return;

    // Calculate counters and outers from successful validation from the channel
    let counter = 0;
    let outers = 0;
    if (channel.processedQrCodes && channel.processedQrCodes.length > 0) {
      counter += channel.processedQrCodes.length;
      outers += channel.processedQrCodes.length;
    }

    // Add product data with package-level counters
    const productData: ProductData = {
      productId: product._id.toString(),
      counter: counter,
      packages: 0,
      outers: outers,
      pallets: undefined,
    };

    // Update only the product data (counters will be aggregated later)
    const existingQr = await this.qrCodeModel.findById(targetQr._id).exec();
    const existingProductData = existingQr?.productData || [];

    // Find existing product entry or create new one
    const existingIndex = existingProductData.findIndex(
      (pd) => pd.productId === product._id.toString()
    );

    if (existingIndex >= 0) {
      // Update existing product data
      existingProductData[existingIndex] = productData;
    } else {
      // Add new product data
      existingProductData.push(productData);
    }

    await this.qrCodeModel
      .findByIdAndUpdate(targetQr._id, {
        productData: existingProductData,
      })
      .exec();

    this.logger.debug(
      `Updated counters for QR: ${targetQr.value} with outer: ${outerQr.value}`
    );
  }


  /**
   * Phase 3: Relationship Update
   */
  private async updateRelationships(
    targetQr: QrCodeDocument,
    outerQr: QrCodeDocument | null
  ) {
    if (!outerQr) return;

    // Update child OUTER QR code to set its direct parent
    await this.qrCodeModel
      .findByIdAndUpdate(outerQr._id, {
        directParent: targetQr.value,
        $addToSet: { parents: targetQr.value },
      })
      .exec();

    this.logger.log(
      `Updated relationships: ${outerQr.value} -> ${targetQr.value}`
    );
  }

  /**
   * Update message status and error message
   */
  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    errorMessage?: string,
    proccessedQrCode?: string
  ): Promise<void> {
    const updateData: any = { status };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    if (proccessedQrCode) {
      updateData.proccessedQrCode = proccessedQrCode;
    }
    await this.channelMessageModel
      .findByIdAndUpdate(messageId, updateData)
      .exec();
  }

  /**
   * Add processed QR code to channel with atomic counter updates.
   *
   * IMPORTANT: This method uses atomic MongoDB operations to prevent race conditions
   * when multiple requests are processed concurrently. Event publishing is done
   * asynchronously (fire-and-forget) after the database update to ensure fast response.
   */
  private async addProcessedQrToChannel(
    channel: ChannelDocument,
    qrCode: string
  ): Promise<ChannelDocument> {
    if (channel.sessionMode === SessionMode.AGGREGATION) {
      return await this.addProcessedQrForPackageAggregation(channel, qrCode);
    }

    // Default: just add to processedQrCodes without counter management
    return await this.channelModel
      .findByIdAndUpdate(
        channel._id,
        { $addToSet: { processedQrCodes: qrCode } },
        { new: true }
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
   * - If processedQrCodes.length % outersPerPackage === 0 (and length > 0) => cycle complete, expect package
   * - Examples (outersPerPackage = 20):
   *   - length = 20: 1st cycle complete
   *   - length = 40: 2nd cycle complete
   *   - length = 60: 3rd cycle complete
   *
   * QR Code Separation:
   * - OUTER QRs go to processedQrCodes
   * - PACKAGE QRs go to processedPackageQrCodes
   */
  private async addProcessedQrForPackageAggregation(
    channel: ChannelDocument,
    qrCode: string
  ): Promise<ChannelDocument> {
    const channelId = channel._id;
    const outersPerPackage = channel.outersPerPackage || 1;

    // Determine if this is a package QR or outer QR based on current array length
    // This was already validated in validateProcessedQrCodeForPackageAggregation
    const totalOuterCount = (channel.processedQrCodes || []).length;
    const totalPackageCount = (channel.processedPackageQrCodes || []).length;
    const completedCycles = Math.floor(totalOuterCount / outersPerPackage);
    const isPackageQr =
      totalOuterCount > 0 &&
      totalOuterCount % outersPerPackage === 0 &&
      completedCycles > totalPackageCount;

    // Calculate the new package count BEFORE the update (we know if we're adding a package or outer)
    const newPackageCount = isPackageQr
      ? totalPackageCount + 1
      : totalPackageCount;

    // Single atomic update: add QR to the correct array AND update currentPackagesCount
    const updatedChannel = await this.channelModel
      .findOneAndUpdate(
        { _id: channelId },
        isPackageQr
          ? {
              $addToSet: { processedPackageQrCodes: qrCode },
              $set: { currentPackagesCount: newPackageCount },
            }
          : {
              $addToSet: { processedQrCodes: qrCode },
            },
        { new: true }
      )
      .exec();

    if (!updatedChannel) {
      throw new Error(`Channel ${channelId} not found during update`);
    }

    // Calculate new outer count from updated channel for cycle detection
    const newOuterCount = (updatedChannel.processedQrCodes || []).length;

    // Detect cycle completion: outer QR was just added and now the count is a multiple of outersPerPackage
    // This means we just completed a cycle (the NEXT QR should be a package)
    const cycleJustCompleted =
      !isPackageQr &&
      newOuterCount > 0 &&
      newOuterCount % outersPerPackage === 0;

    if (cycleJustCompleted) {
      this.logger.log(
        `Cycle ${Math.floor(newOuterCount / outersPerPackage)} completed! ` +
          `Outer count: ${newOuterCount}, expecting package QR next.`
      );
    }

    // Detect package scan completion: a package QR was just added
    if (isPackageQr) {
      // Fire-and-forget: Publish events asynchronously without blocking the response
      this.publishPackageCycleEventsAsync(
        updatedChannel,
        qrCode,
        outersPerPackage
      );
    }

    return updatedChannel;
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
   * - For cycle N, outers are from index (N-1)*outersPerPackage to N*outersPerPackage
   */
  private publishPackageCycleEventsAsync(
    updatedChannel: ChannelDocument,
    packageQrCode: string,
    outersPerPackage: number
  ): void {
    // Use setImmediate to ensure this runs after the current event loop
    setImmediate(async () => {
      try {
        // Get the outers from the UPDATED channel's processedQrCodes
        const allOuterQrs = updatedChannel.processedQrCodes || [];
        const allPackageQrs = updatedChannel.processedPackageQrCodes || [];

        // Cycle number is the count of packages (this package was just added)
        const cycleNumber = allPackageQrs.length;

        // For cycle N, get outers from index (N-1)*outersPerPackage to N*outersPerPackage
        // Example: cycle 1 gets outers 0-19, cycle 2 gets outers 20-39, etc.
        const startIndex = (cycleNumber - 1) * outersPerPackage;
        const endIndex = cycleNumber * outersPerPackage;
        const packageOuters = allOuterQrs.slice(startIndex, endIndex);

        this.logger.log(
          `Package cycle ${cycleNumber} completed with ${packageOuters.length} outers ` +
            `(indices ${startIndex}-${endIndex - 1}): ${packageOuters.join(", ")} ` +
            `and package: ${packageQrCode}`
        );

        // Publish GraphQL subscription event
        await this.publishAggregationEvent(
          updatedChannel._id.toString(),
          "",
          "PACKAGE_COMPLETION",
          {
            packageQr: packageQrCode,
            outersProcessed: packageOuters,
            cycleNumber: cycleNumber,
          },
          null,
          MessageStatus.VALID
        );

        // Publish RabbitMQ event with the package QR and its outers
        await this.packageUpdatePublisher.publishPackageCycleEvent(
          updatedChannel._id.toString(),
          packageQrCode,
          packageOuters,
          undefined,
          updatedChannel.userId,
          {
            triggerSource: "package_reached",
            totalCompleted: cycleNumber,
          }
        );

        this.logger.debug(
          `Package cycle events published successfully for channel ${updatedChannel._id}`
        );
      } catch (error) {
        // Log error but don't throw - this is fire-and-forget
        this.logger.error(
          `Failed to publish package cycle events for channel ${updatedChannel._id}: ${error.message}`,
          error.stack
        );
      }
    });
  }

  // ============ PALLET AGGREGATION HELPER METHODS ============

  /**
   * Configure pallet counters (packages being aggregated into a pallet)
   */
  private async configurePalletCounters(
    palletQr: QrCodeDocument,
    packageQr: QrCodeDocument | null,
    product: ProductDocument | null,
    channel: ChannelDocument
  ) {
    if (!packageQr || !product) return;

    // Calculate counters and packages from successful validation from the channel
    let counter = 0;
    let packages = 0;
    if (channel.processedQrCodes && channel.processedQrCodes.length > 0) {
      packageQr.productData.forEach((pd) => {
        counter += pd.counter;
      });

      packages += channel.processedQrCodes.length; // Each processed QR is a package
    }

    // Add product data with pallet-level counters
    const productData: ProductData = {
      productId: product._id.toString(),
      counter: counter,
      packages: packages,
      outers: undefined, // Not applicable for pallet aggregation
      pallets: 1, // This pallet contains the packages
    };

    // Update the pallet QR with aggregated product data
    const existingQr = await this.qrCodeModel.findById(palletQr._id).exec();
    const existingProductData = existingQr?.productData || [];

    // Find existing product entry or create new one
    const existingIndex = existingProductData.findIndex(
      (pd) => pd.productId === product._id.toString()
    );

    if (existingIndex >= 0) {
      // Update existing product data
      existingProductData[existingIndex] = productData;
    } else {
      // Add new product data
      existingProductData.push(productData);
    }

    await this.qrCodeModel
      .findByIdAndUpdate(palletQr._id, {
        productData: existingProductData,
      })
      .exec();

    this.logger.debug(
      `Updated pallet counters for QR: ${palletQr.value} with package: ${packageQr.value}`
    );
  }

  /**
   * Phase 2B: Enrich pallet QR with metadata from first package QR (one-time operation)
   */
  private async enrichPalletQrMetadata(
    palletQr: QrCodeDocument,
    firstPackageQr: QrCodeDocument,
    product: ProductDocument,
    channel: ChannelDocument
  ) {
    const enrichmentData: any = {
      isConfigured: true,
      hasAgg: false, // Pallet does not have package aggregation
      hasPallet: true, // This IS a pallet
      configuredDate: new Date(),
      supplier: firstPackageQr.supplier,
      vertical: firstPackageQr.vertical,
      productType: firstPackageQr.productType,
      productId: product._id,
      supplierDetails: firstPackageQr.supplierDetails,
      verticalDetails: firstPackageQr.verticalDetails,
      productTypeDetails: firstPackageQr.productTypeDetails,
      products: firstPackageQr.products,
    };

    await this.qrCodeModel
      .findByIdAndUpdate(palletQr._id, enrichmentData)
      .exec();

    this.logger.log(
      `Enriched pallet QR metadata: ${palletQr.value} from first package: ${firstPackageQr.value}`
    );
  }

  /**
   * Update relationships for pallet aggregation (packages -> pallet)
   * Also updates all OUTER QRs that belong to the package to include the pallet in their hierarchy
   */
  private async updatePalletRelationships(
    palletQr: QrCodeDocument,
    packageQr: QrCodeDocument | null
  ) {
    if (!packageQr) return;

    // Update child PACKAGE QR code to set its direct parent as the pallet
    await this.qrCodeModel
      .findByIdAndUpdate(packageQr._id, {
        directParent: palletQr.value,
        $addToSet: { parents: palletQr.value },
      })
      .exec();

    // Find all OUTER QR codes that belong to this package (where directParent = packageQr.value)
    // and update them to include the pallet in their parent hierarchy
    const outerQrs = await this.qrCodeModel
      .find({ directParent: packageQr.value })
      .exec();

    console.log(outerQrs);

    if (outerQrs.length > 0) {
      // Update all OUTER QRs to include the pallet in their parents array
      await Promise.all(
        outerQrs.map((outerQr) =>
          this.qrCodeModel
            .findByIdAndUpdate(outerQr._id, {
              $addToSet: { parents: palletQr.value },
            })
            .exec()
        )
      );

      this.logger.log(
        `Updated ${outerQrs.length} OUTER QRs under package ${packageQr.value} to include pallet ${palletQr.value} in their hierarchy`
      );
    }

    this.logger.log(
      `Updated pallet relationships: ${packageQr.value} -> ${palletQr.value} (with ${outerQrs.length} child OUTER QRs)`
    );
  }

  /**
   * Process a validated message for pallet aggregation through Phase 2A and 3 (Phase 2B handled separately)
   */
  private async processValidatedPalletMessage(
    message: ChannelMessage,
    channel: ChannelDocument,
    palletQr: QrCodeDocument
  ): Promise<void> {
    const { aggregationData } = message;
    if (!aggregationData) return;

    // Find the package QR and product based on the aggregation data
    const packageQr = aggregationData.childQrCode
      ? await this.qrCodeModel
          .findOne({ value: aggregationData.childQrCode })
          .exec()
      : null;

    let product: ProductDocument | null = null;
    if (
      packageQr &&
      packageQr.productData &&
      packageQr.productData.length > 0
    ) {
      product = await this.productModel
        .findById(packageQr.productData[0].productId)
        .exec();
    }

    // Phase 2A: Update counters and product data (per package)
    await this.configurePalletCounters(palletQr, packageQr, product, channel);

    // Phase 3: Relationship Update (per package)
    await this.updatePalletRelationships(palletQr, packageQr);

    // Update message status to completed
    await this.updateMessageStatus(message._id, MessageStatus.VALID);

    // Publish configuration completed event
    await this.publishAggregationEvent(
      channel._id.toString(),
      message._id.toString(),
      "CONFIGURATION_COMPLETED",
      {
        targetQr: palletQr.value,
        packageQr: packageQr?.value,
        product: product?._id,
      },
      null,
      MessageStatus.VALID
    );

    this.logger.log(
      `Successfully configured pallet QR: ${palletQr.value} with package: ${packageQr?.value}`
    );
  }

  /**
   * Publish aggregation event
   */
  private async publishAggregationEvent(
    channelId: string,
    messageId: string,
    eventType: PackageAggregationEvent["eventType"],
    data?: any,
    error?: string,
    status?: MessageStatus
  ): Promise<void> {
    // Serialize complex objects to JSON strings for GraphQL compatibility
    let serializedData: string | undefined;
    if (data !== null && data !== undefined) {
      try {
        serializedData = typeof data === "string" ? data : JSON.stringify(data);
      } catch (serializationError) {
        this.logger.warn(
          `Failed to serialize event data: ${serializationError.message}. Using string representation.`
        );
        serializedData = String(data);
      }
    }

    const event: PackageAggregationEvent = {
      channelId,
      messageId,
      eventType,
      data: serializedData,
      error,
      status,
    };

    await this.pubSubService.publishPackageAggregationEvent(event);
  }

  /**
   * Finalize channel - handles Phase 2 (Configuration), Phase 3 (Relationship Update), and channel closure
   * Supports both PACKAGE_AGGREGATION and FULL_AGGREGATION modes
   */
  async finalizeChannel(channelId: string): Promise<Channel> {
    const startTime = Date.now();
    this.logger.log(
      `Finalizing channel ${channelId} (Configuration and Relationship Update)`
    );

    // Validate channel exists and is in correct state
    const channel = await this.validateChannel(channelId);

    if (channel.status !== ChannelStatus.OPEN) {
      throw new Error(
        `Channel must be in OPEN status to finalize. Current status: ${channel.status}`
      );
    }

    try {
      // Route to appropriate finalization logic based on session mode
      if (channel.sessionMode === SessionMode.AGGREGATION) {
        console.log("Session mode is PACKAGE_AGGREGATION");

        return await this.finalizeAggregation(
          channelId,
          channel,
          startTime
        );
      } else if (channel.sessionMode === SessionMode.SCANNER) {
        return await this.finalizeScanner(
          channelId,
          channel,
          startTime
        );
      } else {
        throw new Error(`Unsupported session mode: ${channel.sessionMode}`);
      }
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      this.logger.error(
        `Failed to finalize channel after ${executionTime}ms: ${error.message}`,
        error.stack
      );
      await this.publishAggregationEvent(
        channelId,
        "",
        "ERROR",
        null,
        error.message,
        MessageStatus.ERROR
      );
      throw error;
    }
  }

  /**
   * Finalize package aggregation channel (array-based logic)
   */
  private async finalizeAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Calculate cycle state from array lengths (new logic)
    const outersPerPackage = channel.outersPerPackage || 1;
    const totalOuters = (channel.processedQrCodes || []).length;
    const remainingOuters = totalOuters % outersPerPackage;

    // Prevent finalization if there are unprocessed outers in the current cycle
    if (remainingOuters !== 0) {
      throw new Error(
        `Cannot finalize channel: There are still ${remainingOuters} outers remaining in the current cycle (${remainingOuters}/${outersPerPackage}).`
      );
    }

    // Update channel status to FINALIZED
    const updatedChannel = await this.channelModel
      .findByIdAndUpdate(
        channelId,
        { status: ChannelStatus.FINALIZED },
        { new: true }
      )
      .exec();

    if (!updatedChannel) {
      throw new Error(`Channel with ID '${channelId}' not found`);
    }

    // Close all opened subscriptions related to this channel
    await this.pubSubService.closeChannelSubscriptions(channelId);

    // Calculate counts from array lengths (new array-based logic)
    const processedOutersCount = totalOuters;
    const processedPackagesCount = (channel.processedPackageQrCodes || [])
      .length;

    // Publish session closed event
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedOutersCount: processedOutersCount,
        processedPackagesCount: processedPackagesCount,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized package aggregation channel ${channelId} with ${processedOutersCount} outers and ${processedPackagesCount} packages in ${executionTime}ms`
    );
    return updatedChannel;
  }


  /**
   * Finalize SCANNER mode channel (real-time QR configuration tracking)
   */
  private async finalizeScanner(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Get all processed messages for this SCANNER session
    const processedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: {
          $in: [MessageStatus.VALID, MessageStatus.CONFIGURED_SUCCESSFULLY],
        },
      })
      .exec();

    // Count successful configurations vs validation errors
    const successfulConfigurations = processedMessages.filter(
      (msg) => msg.status === MessageStatus.CONFIGURED_SUCCESSFULLY
    ).length;

    const validationErrors = await this.channelMessageModel
      .countDocuments({
        channelId,
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

    // Update channel status to FINALIZED
    const updatedChannel = await this.channelModel
      .findByIdAndUpdate(
        channelId,
        {
          status: ChannelStatus.FINALIZED,
          finalizedAt: new Date(),
          // Store session summary in metadata
          metadata: {
            // ...channel.metadata,
            scannerSummary: {
              totalScanned: processedMessages.length + validationErrors,
              successfulConfigurations,
              validationErrors,
              sessionDuration: Date.now() - startTime,
              finalizedAt: new Date(),
            },
          },
        },
        { new: true }
      )
      .exec();

    if (!updatedChannel) {
      throw new Error(`Channel with ID '${channelId}' not found`);
    }

    // Close all opened subscriptions related to this channel
    await this.pubSubService.closeChannelSubscriptions(channelId);

    // Publish session closed event with SCANNER mode statistics
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        sessionMode: SessionMode.SCANNER,
        totalScanned: processedMessages.length + validationErrors,
        successfulConfigurations,
        validationErrors,
        processedQrCodes: channel.processedQrCodes,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized SCANNER mode channel ${channelId} with ${successfulConfigurations}/${processedMessages.length + validationErrors} successful configurations in ${executionTime}ms`
    );

    return updatedChannel;
  }

  /**
   * Update channel status
   */
  async updateChannelStatus(
    channelId: string,
    status: ChannelStatus
  ): Promise<Channel> {
    const updatedChannel = await this.channelModel
      .findByIdAndUpdate(channelId, { status }, { new: true })
      .exec();

    if (!updatedChannel) {
      throw new Error(`Channel with ID '${channelId}' not found`);
    }

    // Publish event when session is closed/finalized
    if (status === ChannelStatus.CLOSED || status === ChannelStatus.FINALIZED) {
      await this.publishAggregationEvent(
        channelId,
        "",
        "SESSION_CLOSED",
        {
          status,
        },
        null,
        MessageStatus.VALID
      );
    }

    return updatedChannel;
  }

  // Package Aggregation methods
  async startAggregation(input: startAggregationInput): Promise<Channel> {
    
    // validate targetQrCode is not used in other open channels if aggregationType is FULL
    if (input.aggregationType === "FULL" && input.targetQrCode) {
      const existingChannel = await this.channelModel
        .findOne({
          targetQrCode: input.targetQrCode,
        })
        .exec();
      if (existingChannel) {
        throw new Error(`Target QR Code '${input.targetQrCode}' is already in use in another channel`);
      }
    }

    // validate targetQrCode based on session mode
    let validationResult;
    const product = await this.productModel.findById(input.productId).exec();
    if (!product) {
      throw new Error(`Product with ID '${input.productId}' not found`);
    }

    if (input.sessionMode === SessionMode.AGGREGATION) {
      if (!product.numberOfPacking || product.numberOfPacking <= 0) {
        throw new Error(
          `numberOfPacking must be greater than 0 for PACKAGE_AGGREGATION mode in the current product`
        );
      }
      if (input.aggregationType === "FULL" && input.targetQrCode) {
        validationResult = await this.validateTargetPalletForAggregation(
          input.targetQrCode
        );
      }
    } else if (input.sessionMode === SessionMode.SCANNER) {
      // This mode is used for real-time QR validation and configuration without aggregation
      this.logger.log(
        `Starting SCANNER mode session for product ${product.name} (${product._id})`
      );
    } else {
      throw new Error(`Unsupported session mode: ${input.sessionMode}`);
    }
    if (validationResult && !validationResult.isValid) {
      throw new Error(validationResult.errorMessage);
    }

    const channelData: any = {
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
        numberOfPallet: product.numberOfPallet,
        orderNumber: product.orderNumber,
        patchId: product.patchId,
        expirationDate: product.expirationDate,
      },
      ...input,
      status: ChannelStatus.OPEN,
      sessionMode: input.sessionMode,
      targetQrCode:
        input.sessionMode === SessionMode.SCANNER
          ? null
          : input.targetQrCode || undefined,
      processedQrCodes: [],
      processedPackageQrCodes: [],
    };

    if (input.sessionMode === SessionMode.AGGREGATION) {
      channelData.outersPerPackage = product?.numberOfPacking;
      channelData.currentPackagesCount = 0;
      channelData.aggregationType = input.aggregationType;
    }
    // Add SCANNER specific fields - minimal configuration for real-time scanning
    if (input.sessionMode === SessionMode.SCANNER) {
      // SCANNER mode specific metadata
      channelData.metadata = {
        ...channelData.metadata,
        scannerMode: true,
        scannerStartedAt: new Date(),
        expectedProductId: product._id.toString(),
        productName: product.name,
        // No aggregation counters needed as SCANNER mode doesn't aggregate
      };

      // Override aggregation-related product fields for SCANNER mode
      channelData.product.hasAggregation = false; // SCANNER mode doesn't do aggregation
      channelData.product.numberOfAggregations = undefined; // Not applicable
      channelData.product.isPalletAvailable = false; // Not applicable for scanning

      this.logger.log(
        `SCANNER mode configured for product: ${product.name} (${product._id})`
      );
    }

    const createdChannel = new this.channelModel(channelData);
    const savedChannel = await createdChannel.save();

    // Publish channel event
    await this.pubSubService.publishChannelEvent(
      {
        id: savedChannel._id.toString(),
        _id: savedChannel._id.toString(),
        name: savedChannel.name,
        description: savedChannel.description,
        status: savedChannel.status,
        sessionMode: savedChannel.sessionMode,
        userId: savedChannel.userId,
        processedQrCodes: savedChannel.processedQrCodes || [],
        createdAt: savedChannel.createdAt,
        updatedAt: savedChannel.updatedAt,
      },
      ChannelEventKind.CREATED
    );

    return savedChannel;
  }
}
