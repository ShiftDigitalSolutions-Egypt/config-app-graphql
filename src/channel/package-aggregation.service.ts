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
import { PackageUpdatePublisher } from "../rabbitmq/publishers/package-update.publisher";

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
      if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
        validationResult = await this.validateOuterForPackageAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.PALLET_AGGREGATION) {
        validationResult = await this.validatePackageForPalletAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.FULL_AGGREGATION) {
        validationResult = await this.validateFullAggregation(input, channel);
      } else if (channel.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
        validationResult = await this.validateFullPackageAggregation(
          input,
          channel
        );
      } else {
        throw new Error(`Unsupported session mode: ${channel.sessionMode}`);
      }

      if (!validationResult.isValid) {
        await this.updateMessageStatus(
          message._id,
          validationResult.status,
          validationResult.errorMessage
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
      await this.updateMessageStatus(message._id, MessageStatus.VALID);
      await this.addProcessedQrToChannel(input.channelId, input.childQrCode);

      // Handle FULL_AGGREGATION state updates
      if (channel.sessionMode === SessionMode.FULL_AGGREGATION) {
        await this.updateFullAggregationState(
          channel._id.toString(),
          validationResult
        );
      }

      // Handle FULL_PACKAGE_AGGREGATION state updates
      if (channel.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
        await this.updateFullPackageAggregationState(
          channel._id.toString(),
          validationResult
        );
      }

      // Publish validation completed event
      const eventData =
        channel.sessionMode === SessionMode.FULL_AGGREGATION
          ? {
              targetQr: channel.targetQrCode,
              childQr: validationResult.childQr?.value,
              product: validationResult.product?._id,
              isPackageQr: validationResult.isPackageQr,
              currentPackageIndex: validationResult.currentPackageIndex,
              currentOuterCount: validationResult.currentOuterCount,
              isSessionComplete: validationResult.isSessionComplete,
            }
          : channel.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION
            ? {
                targetQr: null, // No target QR for this mode
                childQr: validationResult.childQr?.value,
                product: validationResult.product?._id,
                isPackageQr: validationResult.isPackageQr,
                currentOuterCount: validationResult.currentOuterCount,
                outersPerPackage: validationResult.outersPerPackage,
                isWaitingForPackage: validationResult.isWaitingForPackage,
              }
            : {
                targetQr: channel.targetQrCode,
                childQr: validationResult.childQr?.value,
                product: validationResult.product?._id,
              };

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

    if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
      messageContent = `Package aggregation: ${channel.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    } else if (channel.sessionMode === SessionMode.PALLET_AGGREGATION) {
      messageContent = `Pallet aggregation: ${channel.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    } else if (channel.sessionMode === SessionMode.FULL_AGGREGATION) {
      const currentPackageIndex = channel.currentPackageIndex || 0;
      const currentOuterCount = channel.currentOuterCount || 0;
      const packagesPerPallet = channel.packagesPerPallet || 0;
      const outersPerPackage = channel.outersPerPackage || 0;

      const isExpectingPackage =
        currentOuterCount === 0 || !channel.currentPackageQr;
      const qrType = isExpectingPackage ? "Package" : "Outer";

      messageContent = `Full aggregation [${currentPackageIndex}/${packagesPerPallet} packages, ${currentOuterCount}/${outersPerPackage} outers]: ${channel.targetQrCode} -> ${qrType} ${input.childQrCode}`;
    } else if (channel.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
      const currentOuterCount = channel.currentOuterCount || 0;
      const outersPerPackage = channel.outersPerPackage || 0;
      const completedPackages = channel.completedPackages?.length || 0;
      const isWaitingForPackage = channel.isWaitingForPackage || false;

      const qrType = isWaitingForPackage ? "Package" : "Outer";

      messageContent = `Full package aggregation [${completedPackages} packages completed, ${currentOuterCount}/${outersPerPackage} outers]: ${qrType} ${input.childQrCode}`;
    } else {
      messageContent = `Aggregation: ${channel.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    }

    const message = new this.channelMessageModel({
      content: messageContent,
      author: input.author,
      channelId: input.channelId,
      status: MessageStatus.PROCESSING,
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
   */
  private async validateOuterForPackageAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.childQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.childQrCode} has already been processed in this session`,
      };
    }

    let childQr: QrCodeDocument | null = null;
    let product: ProductDocument | null = null;

    // Find and validate OUTER QR code
    childQr = await this.qrCodeModel
      .findOne({ value: input.childQrCode })
      .exec();
    if (!childQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `OUTER QR code '${input.childQrCode}' not found`,
      };
    }

    // Validate QR type is OUTER for package aggregation
    if (childQr.type !== QrCodeTypeGenerator.OUTER) {
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${input.childQrCode}' is not of type OUTER for package aggregation`,
      };
    }

    // Validate OUTER QR is configured
    if (!childQr.configuredDate) {
      return {
        isValid: false,
        status: MessageStatus.NOT_CONFIGURED,
        errorMessage: `OUTER QR code '${input.childQrCode}' is not configured`,
      };
    }

    // Validate OUTER QR is not already aggregated
    if (childQr.directParent || childQr.parents.length > 0) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_AGGREGATED,
        errorMessage: `OUTER QR code '${input.childQrCode}' has already been aggregated`,
      };
    }

    // Get product information from OUTER QR
    if (childQr.productData && childQr.productData.length > 0) {
      product = await this.productModel
        .findById(childQr.productData[0].productId)
        .exec();
    }

    if (!product) {
      return {
        isValid: false,
        status: MessageStatus.PRODUCT_NOT_FOUND,
        errorMessage: `Product not found for OUTER QR code '${input.childQrCode}'`,
      };
    }

    // Validate product ID matches channel productId
    if (product && product._id.toString() !== channel.productId) {
      return {
        isValid: false,
        status: MessageStatus.TYPE_MISMATCH,
        errorMessage: `Product ID '${product._id}' does not match channel productId '${channel.productId}'`,
      };
    }

    return {
      isValid: true,
      childQr,
      product,
    };
  }

  /**
   * Phase 1: Validation of PACKAGE QR codes for pallet aggregation
   */
  private async validatePackageForPalletAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.childQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.childQrCode} has already been processed in this session`,
      };
    }

    let packageQr: QrCodeDocument | null = null;
    let product: ProductDocument | null = null;

    // Find and validate PACKAGE QR code
    packageQr = await this.qrCodeModel
      .findOne({ value: input.childQrCode })
      .exec();
    if (!packageQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `PACKAGE QR code '${input.childQrCode}' not found`,
      };
    }

    // Validate QR Kind is COMPOSED for pallet aggregation (packages are COMPOSED)
    if (packageQr.kind !== QrCodeKind.COMPOSED) {
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${input.childQrCode}' is not of kind COMPOSED (Package) for pallet aggregation`,
      };
    }

    // Validate PACKAGE QR is configured (packages should be configured before being put on pallets)
    if (!packageQr.configuredDate) {
      return {
        isValid: false,
        status: MessageStatus.NOT_CONFIGURED,
        errorMessage: `PACKAGE QR code '${input.childQrCode}' is not configured`,
      };
    }

    // Validate PACKAGE QR is not already on a pallet
    if (packageQr.directParent || packageQr.parents.length > 0) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_AGGREGATED,
        errorMessage: `PACKAGE QR code '${input.childQrCode}' has already been aggregated to a pallet`,
      };
    }

    // Get product information from PACKAGE QR
    if (packageQr.productData && packageQr.productData.length > 0) {
      product = await this.productModel
        .findById(packageQr.productData[0].productId)
        .exec();
    }

    if (!product) {
      return {
        isValid: false,
        status: MessageStatus.PRODUCT_NOT_FOUND,
        errorMessage: `Product not found for PACKAGE QR code '${input.childQrCode}'`,
      };
    }

    // Validate product ID matches channel productId
    if (product && product._id.toString() !== channel.productId) {
      return {
        isValid: false,
        status: MessageStatus.TYPE_MISMATCH,
        errorMessage: `Product ID '${product._id}' does not match channel productId '${channel.productId}'`,
      };
    }

    return {
      isValid: true,
      childQr: packageQr,
      product,
    };
  }

  /**
   * Phase 1: Validation for FULL_AGGREGATION mode (handles both packages and outers)
   */
  private async validateFullAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.childQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.childQrCode} has already been processed in this session`,
      };
    }

    const childQr = await this.qrCodeModel
      .findOne({ value: input.childQrCode })
      .exec();

    if (!childQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `QR code '${input.childQrCode}' not found`,
      };
    }

    // Determine current stage based on channel state
    const currentPackageIndex = channel.currentPackageIndex || 0;
    const currentOuterCount = channel.currentOuterCount || 0;
    const packagesPerPallet = channel.packagesPerPallet || 0;
    const outersPerPackage = channel.outersPerPackage || 0;

    // If we're expecting a package QR
    if (currentOuterCount === 0 || !channel.currentPackageQr) {
      // Validate as package QR
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (COMPOSED), got ${childQr.kind} for '${input.childQrCode}'`,
        };
      }

      if (!childQr.configuredDate) {
        return {
          isValid: false,
          status: MessageStatus.NOT_CONFIGURED,
          errorMessage: `PACKAGE QR '${input.childQrCode}' is not configured`,
        };
      }

      if (childQr.directParent || childQr.parents.length > 0) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_AGGREGATED,
          errorMessage: `PACKAGE QR '${input.childQrCode}' is already aggregated`,
        };
      }
    } else {
      // Validate as outer QR
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected OUTER QR, got ${childQr.type} for '${input.childQrCode}'`,
        };
      }

      if (!childQr.configuredDate) {
        return {
          isValid: false,
          status: MessageStatus.NOT_CONFIGURED,
          errorMessage: `OUTER QR '${input.childQrCode}' is not configured`,
        };
      }

      if (childQr.directParent || childQr.parents.length > 0) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_AGGREGATED,
          errorMessage: `OUTER QR '${input.childQrCode}' is already aggregated`,
        };
      }
    }

    // Get product information
    let product: ProductDocument | null = null;
    if (childQr.productData && childQr.productData.length > 0) {
      product = await this.productModel
        .findById(childQr.productData[0].productId)
        .exec();
    }

    if (!product) {
      return {
        isValid: false,
        status: MessageStatus.PRODUCT_NOT_FOUND,
        errorMessage: `Product not found for QR '${input.childQrCode}'`,
      };
    }

    // Validate product matches channel
    if (product._id.toString() !== channel.productId) {
      return {
        isValid: false,
        status: MessageStatus.TYPE_MISMATCH,
        errorMessage: `Product ID '${product._id}' does not match channel productId '${channel.productId}'`,
      };
    }

    return {
      isValid: true,
      childQr,
      product,
      isPackageQr: currentOuterCount === 0 || !channel.currentPackageQr,
      currentPackageIndex,
      currentOuterCount,
      isSessionComplete: this.checkIfFullAggregationComplete(channel),
    };
  }

  /**
   * Check if FULL_AGGREGATION session is complete
   */
  private checkIfFullAggregationComplete(channel: ChannelDocument): boolean {
    const packagesPerPallet = channel.packagesPerPallet || 0;
    const outersPerPackage = channel.outersPerPackage || 0;
    const currentPackageIndex = channel.currentPackageIndex || 0;
    const currentOuterCount = channel.currentOuterCount || 0;

    // Session is complete if we've processed all packages and all outers for the last package
    return (
      currentPackageIndex >= packagesPerPallet &&
      currentOuterCount >= outersPerPackage
    );
  }

  /**
   * Phase 1: Validation for FULL_PACKAGE_AGGREGATION mode (handles both outers and packages in cycles)
   */
  private async validateFullPackageAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.childQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.childQrCode} has already been processed in this session`,
      };
    }

    const childQr = await this.qrCodeModel
      .findOne({ value: input.childQrCode })
      .exec();

    if (!childQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `QR code '${input.childQrCode}' not found`,
      };
    }

    // Determine current stage based on channel state
    const currentOuterCount = channel.currentOuterCount || 0;
    const outersPerPackage = channel.outersPerPackage || 0;
    const isWaitingForPackage = channel.isWaitingForPackage || false;

    // If we're waiting for a package QR (outers limit reached)
    if (isWaitingForPackage) {
      // Validate as package QR
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected PACKAGE QR (COMPOSED), got ${childQr.kind} for '${input.childQrCode}'`,
        };
      }

      if (childQr.configuredDate) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_CONFIGURED,
          errorMessage: `PACKAGE QR '${input.childQrCode}' is already configured`,
        };
      }

      if (childQr.directParent || childQr.parents.length > 0) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_AGGREGATED,
          errorMessage: `PACKAGE QR '${input.childQrCode}' is already aggregated`,
        };
      }
    } else {
      // Validate as outer QR
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `Expected OUTER QR, got ${childQr.type} for '${input.childQrCode}'`,
        };
      }

      if (!childQr.configuredDate) {
        // For FULL_PACKAGE_AGGREGATION mode, trigger async configuration instead of failing
        this.logger.log(
          `OUTER QR '${input.childQrCode}' is not configured. Publishing async configuration event.`
        );
        
        // Fire-and-forget: publish configuration event to RabbitMQ
        await this.publishQrConfigurationEvent(
          input.childQrCode,
          channel.productId,
          input.channelId,
          channel.sessionMode,
          input.author,
          {
            qrType: 'OUTER',
            originalError: 'QR not configured during aggregation',
            context: {
              sessionMode: channel.sessionMode,
              currentOuterCount: channel.currentOuterCount,
              outersPerPackage: channel.outersPerPackage,
            },
          }
        );

        // Continue with processing as if QR was configured
        // Note: The actual configuration will happen asynchronously
        this.logger.debug(
          `Async configuration event published for QR '${input.childQrCode}'. Continuing aggregation flow.`
        );
      }

      if (childQr.directParent || childQr.parents.length > 0) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_AGGREGATED,
          errorMessage: `OUTER QR '${input.childQrCode}' is already aggregated`,
        };
      }
    }

    // Get product information
    let product: ProductDocument | null = null;
    if (childQr.productData && childQr.productData.length > 0) {
      product = await this.productModel
        .findById(childQr.productData[0].productId)
        .exec();

      if (!product) {
        return {
          isValid: false,
          status: MessageStatus.PRODUCT_NOT_FOUND,
          errorMessage: `Product not found for QR '${input.childQrCode}'`,
        };
      }

      // Validate product matches channel
      if (product._id.toString() !== channel.productId) {
        return {
          isValid: false,
          status: MessageStatus.TYPE_MISMATCH,
          errorMessage: `Product ID '${product._id}' does not match channel productId '${channel.productId}'`,
        };
      }
    }

    return {
      isValid: true,
      childQr,
      product,
      isPackageQr: isWaitingForPackage,
      currentOuterCount,
      outersPerPackage,
      isWaitingForPackage,
    };
  }

  /**
   * Phase 1: Validation of TARGET PACKAGE QR codes for package aggregation
   */
  private async validateTargetPackageForAggregation(targetQrCode: string) {
    // Find and validate target COMPOSED QR code (package)
    const targetQr = await this.qrCodeModel
      .findOne({ value: targetQrCode })
      .exec();
    if (!targetQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `PACKAGE QR code '${targetQrCode}' not found`,
      };
    }

    // Validate QR type is COMPOSED (for package)
    if (targetQr.kind !== QrCodeKind.COMPOSED) {
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${targetQrCode}' is not of type COMPOSED (Package)`,
      };
    }

    // Validate QR is not yet configured
    if (targetQr.configuredDate) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_CONFIGURED,
        errorMessage: `PACKAGE QR code '${targetQrCode}' is already configured`,
      };
    }

    return { isValid: true, targetQr };
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
   * Phase 2B: Enrich target QR with metadata from first outer QR (one-time operation)
   */
  private async enrichPackageQrMetadata(
    targetQr: QrCodeDocument,
    firstOuterQr: QrCodeDocument,
    product: ProductDocument,
    channel: ChannelDocument
  ) {
    const enrichmentData: any = {
      isConfigured: true,
      hasAgg: true,
      hasPallet: false,
      configuredDate: new Date(),
      supplier: firstOuterQr.supplier,
      vertical: firstOuterQr.vertical,
      productType: firstOuterQr.productType,
      productId: product._id,
      supplierDetails: firstOuterQr.supplierDetails,
      verticalDetails: firstOuterQr.verticalDetails,
      productTypeDetails: firstOuterQr.productTypeDetails,
      products: firstOuterQr.products,
    };

    await this.qrCodeModel
      .findByIdAndUpdate(targetQr._id, enrichmentData)
      .exec();

    this.logger.log(
      `Enriched target QR metadata: ${targetQr.value} from first outer: ${firstOuterQr.value}`
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
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.channelMessageModel
      .findByIdAndUpdate(messageId, updateData)
      .exec();
  }

  /**
   * Add processed QR code to channel
   */
  private async addProcessedQrToChannel(
    channelId: string,
    qrCode: string
  ): Promise<void> {
    await this.channelModel
      .findByIdAndUpdate(channelId, {
        $addToSet: { processedQrCodes: qrCode },
      })
      .exec();
  }

  /**
   * Update FULL_AGGREGATION channel state based on validation result
   */
  private async updateFullAggregationState(
    channelId: string,
    validationResult: any
  ): Promise<void> {
    const updateData: any = {};

    if (validationResult.isPackageQr) {
      // Processing a package QR - set as current package and reset outer count
      updateData.currentPackageQr = validationResult.childQr.value;
      updateData.currentOuterCount = 0;
      updateData.currentPackageIndex =
        (validationResult.currentPackageIndex || 0) + 1;
    } else {
      // Processing an outer QR - increment outer count
      updateData.currentOuterCount =
        (validationResult.currentOuterCount || 0) + 1;

      // If we've reached the outer limit for this package, prepare for next package
      const channel = await this.channelModel.findById(channelId).exec();
      if (updateData.currentOuterCount >= (channel?.outersPerPackage || 0)) {
        updateData.currentPackageQr = null; // Ready for next package
      }
    }

    await this.channelModel.findByIdAndUpdate(channelId, updateData).exec();
  }

  /**
   * Update FULL_PACKAGE_AGGREGATION channel state based on validation result
   */
  private async updateFullPackageAggregationState(
    channelId: string,
    validationResult: any
  ): Promise<void> {
    const updateData: any = {};

    if (validationResult.isPackageQr) {
      // Processing a package QR - TRIGGER REAL-TIME PROCESSING
      this.logger.log(`Package QR reached: ${validationResult.childQr.value}. Triggering real-time processing.`);
      
      // Get basic channel info for publishing
      const channel = await this.channelModel.findById(channelId).exec();
      if (channel) {
        // Publish simplified real-time package cycle event
        // Database operations (outer messages retrieval, channel updates) now handled in consumer
        try {
          const eventId = await this.packageUpdatePublisher.publishPackageCycleEvent(
            channelId,
            validationResult.childQr.value,
            channel.sessionMode,
            'system-real-time', // author
            channel.completedPackages?.length || 0, // cycle number
            {
              triggerSource: 'package_reached',
              totalCompleted: channel.completedPackages?.length || 0,
            }
          );
          
          this.logger.log(
            `Published package cycle event ${eventId} for package: ${validationResult.childQr.value}`
          );
        } catch (error) {
          this.logger.error(
            `Failed to publish package cycle event for package ${validationResult.childQr.value}: ${error.message}`,
            error.stack
          );
        }
      }
      // Update channel state - add to completed packages, reset state for next cycle
      updateData.isWaitingForPackage = false;
      updateData.currentOuterCount = 0;
      updateData.$push = { completedPackages: validationResult.childQr.value };

      // Note: Channel state updates (completedPackages, reset counters) now handled in consumer
      // This allows service layer to respond immediately without waiting for processing
      this.logger.debug(`Package cycle event published. Channel updates will be handled asynchronously.`);
    } else {
      // Processing an outer QR - increment outer count
      const newOuterCount = (validationResult.currentOuterCount || 0) + 1;
      updateData.currentOuterCount = newOuterCount;

      // If we've reached the outer limit, wait for package QR
      if (newOuterCount >= (validationResult.outersPerPackage || 0)) {
        updateData.isWaitingForPackage = true;
        this.logger.log(`Outer limit reached (${newOuterCount}/${validationResult.outersPerPackage}). Waiting for package QR.`);
      }

      // Update channel state for outer QR processing
      await this.channelModel.findByIdAndUpdate(channelId, updateData).exec();
    }
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
   * Supports both PACKAGE_AGGREGATION and PALLET_AGGREGATION modes
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
      if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
        console.log("Session mode is PACKAGE_AGGREGATION");

        return await this.finalizePackageAggregation(
          channelId,
          channel,
          startTime
        );
      } else if (channel.sessionMode === SessionMode.PALLET_AGGREGATION) {
        console.log("Session mode is PALLET_AGGREGATION");

        return await this.finalizePalletAggregation(
          channelId,
          channel,
          startTime
        );
      } else if (channel.sessionMode === SessionMode.FULL_AGGREGATION) {
        console.log("Session mode is FULL_AGGREGATION");

        return await this.finalizeFullAggregation(
          channelId,
          channel,
          startTime
        );
      } else if (channel.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
        console.log("Session mode is FULL_PACKAGE_AGGREGATION");

        return await this.finalizeFullPackageAggregation(
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
   * Finalize package aggregation channel (original logic)
   */
  private async finalizePackageAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Get all validated messages from this channel that need configuration
    const validatedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: MessageStatus.VALID,
        aggregationData: { $exists: true },
      })
      .exec();

    if (validatedMessages.length === 0) {
      this.logger.warn(`No validated messages found for channel ${channelId}`);
    } else {
      // Find the target QR and first outer QR for one-time enrichment
      const targetQr = await this.qrCodeModel
        .findOne({ value: channel.targetQrCode })
        .exec();

      if (!targetQr) {
        throw new Error(
          `Target QR code '${channel.targetQrCode}' not found during finalization`
        );
      }

      // Find first outer QR for enrichment
      const firstMessage = validatedMessages[0];
      const firstOuterQr = firstMessage.aggregationData?.childQrCode
        ? await this.qrCodeModel
            .findOne({ value: firstMessage.aggregationData.childQrCode })
            .exec()
        : null;

      let firstProduct: ProductDocument | null = null;
      if (
        firstOuterQr &&
        firstOuterQr.productData &&
        firstOuterQr.productData.length > 0
      ) {
        firstProduct = await this.productModel
          .findById(firstOuterQr.productData[0].productId)
          .exec();
      }

      // Phase 2B: One-time enrichment with metadata from first outer QR
      if (firstOuterQr && firstProduct) {
        await this.enrichPackageQrMetadata(
          targetQr,
          firstOuterQr,
          firstProduct,
          channel
        );
      }

      // Process each validated message through Phase 2A and Phase 3
      await Promise.all(
        validatedMessages.map((message) =>
          this.processValidatedMessage(message, channel, targetQr)
        )
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

    // Publish session closed event
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: validatedMessages.length,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized package aggregation channel ${channelId} with ${validatedMessages.length} processed messages in ${executionTime}ms`
    );
    return updatedChannel;
  }

  /**
   * Finalize pallet aggregation channel (new logic for pallets)
   */
  private async finalizePalletAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Get all validated messages from this channel that need configuration
    const validatedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: MessageStatus.VALID,
        aggregationData: { $exists: true },
      })
      .exec();

    if (validatedMessages.length === 0) {
      this.logger.warn(`No validated messages found for channel ${channelId}`);
    } else {
      // Find the target QR (pallet) and first package QR for one-time enrichment
      const targetQr = await this.qrCodeModel
        .findOne({ value: channel.targetQrCode })
        .exec();

      if (!targetQr) {
        throw new Error(
          `Target pallet QR code '${channel.targetQrCode}' not found during finalization`
        );
      }

      // Find first package QR for enrichment
      const firstMessage = validatedMessages[0];
      const firstPackageQr = firstMessage.aggregationData?.childQrCode
        ? await this.qrCodeModel
            .findOne({ value: firstMessage.aggregationData.childQrCode })
            .exec()
        : null;

      let firstProduct: ProductDocument | null = null;
      if (
        firstPackageQr &&
        firstPackageQr.productData &&
        firstPackageQr.productData.length > 0
      ) {
        firstProduct = await this.productModel
          .findById(firstPackageQr.productData[0].productId)
          .exec();
      }

      // Phase 2B: One-time enrichment with metadata from first package QR
      if (firstPackageQr && firstProduct) {
        await this.enrichPalletQrMetadata(
          targetQr,
          firstPackageQr,
          firstProduct,
          channel
        );
      }

      // Process each validated message through Phase 2A and Phase 3
      await Promise.all(
        validatedMessages.map((message) =>
          this.processValidatedPalletMessage(message, channel, targetQr)
        )
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

    // Publish session closed event
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: validatedMessages.length,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized pallet aggregation channel ${channelId} with ${validatedMessages.length} processed packages in ${executionTime}ms`
    );
    return updatedChannel;
  }

  /**
   * Finalize full aggregation channel (handles both package and pallet logic)
   */
  private async finalizeFullAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Get all validated messages from this channel
    const validatedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: MessageStatus.VALID,
        aggregationData: { $exists: true },
      })
      .exec();

    if (validatedMessages.length === 0) {
      this.logger.warn(`No validated messages found for channel ${channelId}`);
    } else {
      // Process FULL_AGGREGATION in phases:
      // Phase 1: Group messages by packages and outers
      // Phase 2: Process package aggregations (outers -> packages)
      // Phase 3: Process pallet aggregation (packages -> pallet)

      const { packageMessages, outerMessages } =
        await this.groupFullAggregationMessages(validatedMessages);

      // Find the target pallet QR
      const targetPalletQr = await this.qrCodeModel
        .findOne({ value: channel.targetQrCode })
        .exec();

      if (!targetPalletQr) {
        throw new Error(
          `Target pallet QR code '${channel.targetQrCode}' not found during finalization`
        );
      }

      // Phase 2A: Process package aggregations (outers -> packages)
      await this.processFullAggregationPackages(
        packageMessages,
        outerMessages,
        channel
      );

      // Phase 2B: Process pallet aggregation (packages -> pallet)
      await this.processFullAggregationPallet(
        packageMessages,
        targetPalletQr,
        channel
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

    // Publish session closed event
    const { packageMessages: finalPackageMessages } =
      await this.groupFullAggregationMessages(validatedMessages);
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: validatedMessages.length,
        packagesProcessed: Object.keys(finalPackageMessages).length,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized full aggregation channel ${channelId} with ${validatedMessages.length} processed QRs in ${executionTime}ms`
    );
    return updatedChannel;
  }

  /**
   * Finalize full package aggregation channel (multiple package cycles without target)
   */
  private async finalizeFullPackageAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Validate that all packages are properly completed
    const validationResult =
      this.validateFullPackageAggregationForFinalization(channel);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errorMessage);
    }

    // Get count of validated messages for reporting purposes only
    const validatedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: MessageStatus.VALID,
        aggregationData: { $exists: true },
      })
      .exec();

    this.logger.log(
      `Finalizing FULL_PACKAGE_AGGREGATION channel ${channelId}. Found ${validatedMessages.length} validated messages (already processed in real-time).`
    );

    // Update channel status to FINALIZED (channel-level operation only)
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

    // Close all opened subscriptions related to this channel (channel-level operation)
    await this.pubSubService.closeChannelSubscriptions(channelId);

    // Publish session closed event (channel-level operation)
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: validatedMessages.length,
        packagesCompleted: channel.completedPackages?.length || 0,
        processingMode: 'REAL_TIME_CYCLES',
        note: 'QR processing was handled in real-time during package cycles'
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized FULL_PACKAGE_AGGREGATION channel ${channelId} with ${channel.completedPackages?.length || 0} packages (${validatedMessages.length} total messages) in ${executionTime}ms. All QR processing was handled in real-time.`
    );
    
    return updatedChannel;
  }

  /**
   * Validate that FULL_PACKAGE_AGGREGATION channel is ready for finalization
   */
  private validateFullPackageAggregationForFinalization(
    channel: ChannelDocument
  ) {
    // Check if there are incomplete packages
    const currentOuterCount = channel.currentOuterCount || 0;
    const outersPerPackage = channel.outersPerPackage || 0;
    const isWaitingForPackage = channel.isWaitingForPackage || false;

    // If we have outers processed but haven't reached the limit and no package QR provided
    if (
      currentOuterCount > 0 &&
      currentOuterCount < outersPerPackage &&
      !isWaitingForPackage
    ) {
      return {
        isValid: false,
        errorMessage: `Channel has incomplete package cycle: ${currentOuterCount}/${outersPerPackage} outers processed. All package cycles must be complete before finalization.`,
      };
    }

    // If waiting for package QR (outers limit reached but no package provided)
    if (isWaitingForPackage) {
      return {
        isValid: false,
        errorMessage: `Channel is waiting for package QR. ${outersPerPackage} outers have been processed, but the corresponding package QR has not been provided.`,
      };
    }

    // Check if any packages have been completed
    const completedPackages = channel.completedPackages || [];
    if (completedPackages.length === 0) {
      return {
        isValid: false,
        errorMessage: `No packages have been completed. At least one complete package cycle (outers + package QR) is required before finalization.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Group FULL_PACKAGE_AGGREGATION messages by package cycles
   */
  private async groupFullPackageAggregationMessages(
    validatedMessages: ChannelMessage[]
  ) {
    const packageCycles: { [packageQr: string]: ChannelMessage[] } = {};
    let currentPackageQr: string | null = null;
    let currentCycleOuters: ChannelMessage[] = [];

    // Process messages chronologically to maintain package cycles
    for (const message of validatedMessages) {
      const childQrCode = message.aggregationData?.childQrCode;
      if (!childQrCode) continue;

      // Check if this is a package or outer QR
      const qrDoc = await this.qrCodeModel
        .findOne({ value: childQrCode })
        .exec();

      if (!qrDoc) continue;

      const isPackage = qrDoc.kind === QrCodeKind.COMPOSED;

      if (isPackage) {
        // This is a package QR - assign accumulated outers to this package
        if (currentCycleOuters.length > 0) {
          packageCycles[childQrCode] = [...currentCycleOuters];
          currentCycleOuters = []; // Reset for next cycle
        }
        currentPackageQr = childQrCode;
      } else if (qrDoc.type === QrCodeTypeGenerator.OUTER) {
        // This is an outer QR - accumulate for the next package cycle
        currentCycleOuters.push(message);
      }
    }

    // Handle any remaining outers without a corresponding package QR
    // (This shouldn't happen in a properly completed FULL_PACKAGE_AGGREGATION)
    if (currentCycleOuters.length > 0) {
      this.logger.warn(
        `Found ${currentCycleOuters.length} outer QRs without corresponding package QR during finalization`
      );
    }

    return { packageCycles };
  }

  /**
   * Group FULL_AGGREGATION messages by packages and outers
   */
  private async groupFullAggregationMessages(
    validatedMessages: ChannelMessage[]
  ) {
    const packageMessages: { [packageQr: string]: ChannelMessage } = {};
    const outerMessages: { [packageQr: string]: ChannelMessage[] } = {};
    let currentPackageQr: string | null = null;

    for (const message of validatedMessages) {
      const childQrCode = message.aggregationData?.childQrCode;
      if (!childQrCode) continue;

      // Check the actual QR type from database
      const qrDoc = await this.qrCodeModel
        .findOne({ value: childQrCode })
        .exec();

      if (!qrDoc) continue;

      const isPackage = qrDoc.kind === QrCodeKind.COMPOSED;

      if (isPackage) {
        // This is a package QR
        packageMessages[childQrCode] = message;
        outerMessages[childQrCode] = []; // Initialize outer array for this package
        currentPackageQr = childQrCode; // Set as current package
      } else if (qrDoc.type === QrCodeTypeGenerator.OUTER && currentPackageQr) {
        // This is an outer QR, assign to current package
        if (!outerMessages[currentPackageQr]) {
          outerMessages[currentPackageQr] = [];
        }
        outerMessages[currentPackageQr].push(message);
      }
    }

    return { packageMessages, outerMessages };
  }

  /**
   * Process package aggregations (outers -> packages) for FULL_AGGREGATION
   */
  private async processFullAggregationPackages(
    packageMessages: { [packageQr: string]: ChannelMessage },
    outerMessages: { [packageQr: string]: ChannelMessage[] },
    channel: ChannelDocument
  ): Promise<void> {
    for (const [packageQrCode, packageMessage] of Object.entries(
      packageMessages
    )) {
      const packageQr = await this.qrCodeModel
        .findOne({ value: packageQrCode })
        .exec();

      if (!packageQr) continue;

      const associatedOuters = outerMessages[packageQrCode] || [];

      if (associatedOuters.length > 0) {
        // Get first outer for metadata enrichment
        const firstOuterMessage = associatedOuters[0];
        const firstOuterQr = firstOuterMessage.aggregationData?.childQrCode
          ? await this.qrCodeModel
              .findOne({ value: firstOuterMessage.aggregationData.childQrCode })
              .exec()
          : null;

        let firstProduct: ProductDocument | null = null;
        if (
          firstOuterQr &&
          firstOuterQr.productData &&
          firstOuterQr.productData.length > 0
        ) {
          firstProduct = await this.productModel
            .findById(firstOuterQr.productData[0].productId)
            .exec();
        }

        // Phase 2B: One-time enrichment with metadata from first outer QR
        if (firstOuterQr && firstProduct) {
          await this.enrichPackageQrMetadata(
            packageQr,
            firstOuterQr,
            firstProduct,
            channel
          );
        }

        // Process each outer message for this package
        await Promise.all(
          associatedOuters.map((outerMessage) =>
            this.processValidatedMessage(outerMessage, channel, packageQr)
          )
        );

        // Publish package completion event
        await this.publishAggregationEvent(
          channel._id.toString(),
          packageMessage._id.toString(),
          "PACKAGE_COMPLETION",
          {
            packageQr: packageQrCode,
            outersProcessed: associatedOuters.length,
          },
          null,
          MessageStatus.VALID
        );
      }
    }
  }

  /**
   * Process pallet aggregation (packages -> pallet) for FULL_AGGREGATION
   */
  private async processFullAggregationPallet(
    packageMessages: { [packageQr: string]: ChannelMessage },
    palletQr: QrCodeDocument,
    channel: ChannelDocument
  ): Promise<void> {
    const packageQrs = Object.keys(packageMessages);

    if (packageQrs.length > 0) {
      // Get first package for metadata enrichment
      const firstPackageQrCode = packageQrs[0];
      const firstPackageQr = await this.qrCodeModel
        .findOne({ value: firstPackageQrCode })
        .exec();

      let firstProduct: ProductDocument | null = null;
      if (
        firstPackageQr &&
        firstPackageQr.productData &&
        firstPackageQr.productData.length > 0
      ) {
        firstProduct = await this.productModel
          .findById(firstPackageQr.productData[0].productId)
          .exec();
      }

      // Phase 2B: One-time enrichment with metadata from first package QR
      if (firstPackageQr && firstProduct) {
        await this.enrichPalletQrMetadata(
          palletQr,
          firstPackageQr,
          firstProduct,
          channel
        );
      }

      // Process each package message for the pallet
      await Promise.all(
        Object.values(packageMessages).map((packageMessage) =>
          this.processValidatedPalletMessage(packageMessage, channel, palletQr)
        )
      );

      // Publish pallet completion event
      await this.publishAggregationEvent(
        channel._id.toString(),
        "",
        "PALLET_COMPLETION",
        {
          palletQr: palletQr.value,
          packagesProcessed: packageQrs.length,
        },
        null,
        MessageStatus.VALID
      );
    }
  }

  /**
   * Process a validated message through Phase 2A and 3 (Phase 2B handled separately)
   */
  private async processValidatedMessage(
    message: ChannelMessage,
    channel: ChannelDocument,
    targetQr: QrCodeDocument
  ): Promise<void> {
    const { aggregationData } = message;
    if (!aggregationData) return;

    // Find the outer QR and product based on the aggregation data
    const outerQr = aggregationData.childQrCode
      ? await this.qrCodeModel
          .findOne({ value: aggregationData.childQrCode })
          .exec()
      : null;

    let product: ProductDocument | null = null;
    if (outerQr && outerQr.productData && outerQr.productData.length > 0) {
      product = await this.productModel
        .findById(outerQr.productData[0].productId)
        .exec();
    }

    // Phase 2A: Update counters and product data (per outerQr)
    await this.configurePackageCounters(targetQr, outerQr, product, channel);

    // Phase 3: Relationship Update (per outerQr)
    await this.updateRelationships(targetQr, outerQr);

    // Update message status to completed
    await this.updateMessageStatus(message._id, MessageStatus.VALID);

    // Publish configuration completed event
    await this.publishAggregationEvent(
      channel._id.toString(),
      message._id.toString(),
      "CONFIGURATION_COMPLETED",
      {
        targetQr: targetQr.value,
        outerQr: outerQr?.value,
        product: product?._id,
      },
      null,
      MessageStatus.VALID
    );

    this.logger.log(
      `Successfully configured QR: ${targetQr.value} with outer: ${outerQr?.value}`
    );
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
    // validate targetQrCode is not used in other open channels if then return the old one
    const existingChannel = await this.channelModel
      .findOne({
        targetQrCode: input.targetQrCode,
        status: ChannelStatus.OPEN,
      })
      .exec();
    if (existingChannel) {
      this.logger.log(
        `Reusing existing open channel for target QR: ${input.targetQrCode}`
      );
      return existingChannel;
    }

    // validate targetQrCode based on session mode
    let validationResult;
    if (input.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
      validationResult = await this.validateTargetPackageForAggregation(
        input.targetQrCode!
      );
    } else if (input.sessionMode === SessionMode.PALLET_AGGREGATION) {
      validationResult = await this.validateTargetPalletForAggregation(
        input.targetQrCode!
      );
    } else if (input.sessionMode === SessionMode.FULL_AGGREGATION) {
      // For FULL_AGGREGATION, validate as pallet QR since that's the top level
      validationResult = await this.validateTargetPalletForAggregation(
        input.targetQrCode!
      );

      // Additional validation for FULL_AGGREGATION parameters
      if (!input.packagesPerPallet || input.packagesPerPallet <= 0) {
        throw new Error(
          `packagesPerPallet must be greater than 0 for FULL_AGGREGATION mode`
        );
      }
      if (!input.outersPerPackage || input.outersPerPackage <= 0) {
        throw new Error(
          `outersPerPackage must be greater than 0 for FULL_AGGREGATION mode`
        );
      }
    } else if (input.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
      // For FULL_PACKAGE_AGGREGATION, no target QR validation needed
      // Validate required parameters
      if (!input.outersPerPackage || input.outersPerPackage <= 0) {
        throw new Error(
          `outersPerPackage must be greater than 0 for FULL_PACKAGE_AGGREGATION mode`
        );
      }

      // Set dummy validation result since no target QR validation needed
      validationResult = { isValid: true };
    } else {
      throw new Error(`Unsupported session mode: ${input.sessionMode}`);
    }

    if (!validationResult.isValid) {
      throw new Error(validationResult.errorMessage);
    }

    const channelData: any = {
      ...input,
      status: ChannelStatus.OPEN,
      sessionMode: input.sessionMode,
      targetQrCode: input.targetQrCode,
      processedQrCodes: [],
    };

    // Add FULL_AGGREGATION specific fields
    if (input.sessionMode === SessionMode.FULL_AGGREGATION) {
      channelData.packagesPerPallet = input.packagesPerPallet;
      channelData.outersPerPackage = input.outersPerPackage;
      channelData.currentPackageIndex = 0;
      channelData.currentOuterCount = 0;
      channelData.currentPackageQr = null;
    }

    // Add FULL_PACKAGE_AGGREGATION specific fields
    if (input.sessionMode === SessionMode.FULL_PACKAGE_AGGREGATION) {
      channelData.outersPerPackage = input.outersPerPackage;
      channelData.currentOuterCount = 0;
      channelData.completedPackages = [];
      channelData.isWaitingForPackage = false;
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

  /**
   * Publish QR configuration event for async processing
   * This is a fire-and-forget operation that doesn't block the main flow
   */
  private async publishQrConfigurationEvent(
    qrCodeValue: string,
    productId: string,
    channelId: string,
    sessionMode: string,
    author: string,
    metadata?: any
  ): Promise<void> {

    try {
      // Publish the event to RabbitMQ
      // await this.rabbitMQPublisher.publishQrConfigurationEvent(
      //   qrCodeValue, productId, channelId, sessionMode, author, metadata
      // );
      

    } catch (error) {
      // Fire-and-forget: log error but don't throw to avoid interrupting main flow
      this.logger.error(
        `Failed to publish QR configuration event for QR ${qrCodeValue}: ${error.message}`,
        error.stack
      );
    }
  }
}
