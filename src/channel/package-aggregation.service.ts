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
    private readonly qrConfigurationPublisher: QrConfigurationPublisher,
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
        validationResult = await this.validateProcessedQrCodeForPackageAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.PALLET_AGGREGATION) {
        validationResult = await this.validatePackageForPalletAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
        validationResult = await this.validateOuterForUnitPalletAggregation(
          input,
          channel
        );
      } else if (channel.sessionMode === SessionMode.SCANNER) {
        validationResult = await this.validateScannerMode(
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
      await this.updateMessageStatus(message._id, MessageStatus.VALID, null, input.childQrCode);
      const updatedChannel = await this.addProcessedQrToChannel(channel, input.childQrCode);

      // Publish validation completed event
      let eventData ={}
    
      if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
         eventData = {
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
          outersPerPackage: updatedChannel.outersPerPackage,
          currentOuterCount: updatedChannel.currentOuterCount,
          currentPackagesCount: updatedChannel.currentPackagesCount,
        };
      }
      else if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
        eventData = {
          targetQr: channel.targetQrCode,
          childQr: validationResult.childQr?.value,
          product: validationResult.product?._id,
          outersPerPallet: updatedChannel.outersPerPallet,
          currentOuterCount: updatedChannel.currentOuterCount,
          currentPalletsCount: updatedChannel.currentPalletsCount,
        };
      }
      else if (channel.sessionMode === SessionMode.SCANNER) {
        eventData = {
          qrCode: validationResult.qrEntity?.value,
          product: validationResult.product?._id,
          configurationStatus: validationResult.status,
          message: validationResult.message,
        };
      }
      else {
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
    
    if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
      {
        const outersPerPackage = channel.outersPerPackage || 0;
        const currentOuterCount = channel.currentOuterCount || 0;
        const currentPackagesCount = channel.currentPackagesCount || 0;

        const isExpectingPackage = currentOuterCount === channel.outersPerPackage;
        const qrType = isExpectingPackage ? "Package" : "Outer";

        messageContent = `Package aggregation: [${currentOuterCount}/${outersPerPackage} outers, ${currentPackagesCount} packages] ->  Current QR: ${input.childQrCode} the expected qrType is ${qrType}`;
      }; 
    } else if (channel.sessionMode === SessionMode.PALLET_AGGREGATION) {
      messageContent = `Pallet aggregation: ${channel.targetQrCode}${input.childQrCode ? ` -> ${input.childQrCode}` : ""}`;
    } else if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
      const outersPerPallet = channel.outersPerPallet || 0;
      const currentOuterCount = channel.currentOuterCount || 0;
      const currentPalletsCount = channel.currentPalletsCount || 0;

      messageContent = `Unit pallet aggregation: [${currentOuterCount}/${outersPerPallet} outers, ${currentPalletsCount} pallets] -> Current QR: ${input.childQrCode}`;
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
      proccessedQrCode: input.childQrCode ? input.childQrCode : channel.targetQrCode,
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
  private async validateProcessedQrCodeForPackageAggregation(
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

    // Check if child QR matches qrCode in channel messages and is valid
    const channelMessages = await this.channelMessageModel
      .find({
        proccessedQrCode: input.childQrCode,
        status: MessageStatus.VALID,
      })
      .exec();

    if (channelMessages.length > 0) {

      // TODO: is the suitable error status ALREADY_AGGREGATED or ALREADY_CONFIGURED?
      return {
        isValid: false,
        status: MessageStatus.ALREADY_AGGREGATED,
        errorMessage: `QR code ${input.childQrCode} has already been aggregated before`,
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
    /* If outersPerPackage === currentOuterCount => expecting PACKAGE QR
     * Else expecting OUTER QR
     */
    if( channel.outersPerPackage === (channel.currentOuterCount || 0)) {
      // Validate QR Kind is COMPOSED for package aggregation
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${input.childQrCode}' is not of kind COMPOSED (Package) for package aggregation`,
        };
      }
    }else {
      // Validate QR type is OUTER for package aggregation
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${input.childQrCode}' is not of type OUTER for package aggregation`,
        };
      }
    }

    // Validate  QR is configured
    if (childQr.configuredDate || childQr.isConfigured || childQr?.productData.length > 0) {
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
      const product = await this.productModel.findById(channel.productId).exec();
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
        'SCANNER',
        'channel-system', // Default author for channel operations
      );

      return {
        isValid: true,
        status: MessageStatus.CONFIGURED_SUCCESSFULLY,
        message: `QR code '${qrCode}' validated and configuration event published`,
        qrEntity,
        product
      };

    } catch (error) {
      this.logger.error(`Error validating QR code '${qrCode}': ${error.message}`, error.stack);
      return {
        isValid: false,
        status: MessageStatus.VALIDATION_ERROR,
        errorMessage: `Error validating QR code '${qrCode}': ${error.message}`,
      };
    }
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
   * Phase 1: Validation of OUTER QR codes for unit pallet aggregation
   * This mode aggregates outer QRs directly to a pallet, skipping the package level
   * If outer QR is not configured, it will be automatically configured via RabbitMQ
   */
  private async validateOuterForUnitPalletAggregation(
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

    /* If outersPerPallet === currentOuterCount => expecting PALLET QR (COMPOSED)
     * Else expecting OUTER QR
     */
    if (channel.outersPerPallet === (channel.currentOuterCount || 0)) {
      // Validate QR Kind is COMPOSED for pallet aggregation
      if (childQr.kind !== QrCodeKind.COMPOSED) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${input.childQrCode}' is not of kind COMPOSED (Pallet) for unit pallet aggregation`,
        };
      }
    } else {
      // Validate QR type is OUTER for unit pallet aggregation
      if (childQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${input.childQrCode}' is not of type OUTER for unit pallet aggregation`,
        };
      }
    }

    // Check if QR is already configured - if so, reject it (similar to PACKAGE_AGGREGATION)
    if (childQr.configuredDate || childQr.isConfigured || childQr?.productData.length > 0) {
      return {
        isValid: false,
        status: MessageStatus.IS_CONFIGURED,
        errorMessage: `QR code '${input.childQrCode}' is already configured`,
      };
    }

    // Validate QR is not already aggregated
    if (childQr.directParent || childQr.parents.length > 0) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_AGGREGATED,
        errorMessage: `QR code '${input.childQrCode}' has already been aggregated`,
      };
    }

    // Get product information from channel productId (since QR is not configured yet)
    product = await this.productModel.findById(channel.productId).exec();

    if (!product) {
      return {
        isValid: false,
        status: MessageStatus.PRODUCT_NOT_FOUND,
        errorMessage: `Product not found for channel productId '${channel.productId}'`,
      };
    }

    // Trigger QR configuration via RabbitMQ for unconfigured QR
    // This follows the same async pattern as PACKAGE_AGGREGATION
    await this.qrConfigurationPublisher.publishQrConfigurationEvent(
      input.childQrCode,
      product._id.toString(),
      channel._id.toString(),
      'UNIT_PALLET_AGGREGATION',
      input.author || 'channel-system',
    );

    this.logger.log(
      `Triggered QR configuration event for QR '${input.childQrCode}' in UNIT_PALLET_AGGREGATION mode`
    );

    return {
      isValid: true,
      childQr: childQr,
      product,
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
    errorMessage?: string,
    proccessedQrCode?:string
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
   * Add processed QR code to channel
   */
  private async addProcessedQrToChannel(
    channel: ChannelDocument,
    qrCode: string
  ): Promise<ChannelDocument> {
    let updateData: any = {
      $addToSet: { processedQrCodes: qrCode },
    };
    let newCounts = null;
    if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
      newCounts = await this.getNewChannelCountsForPackageAggregation(channel, qrCode);
      if (newCounts) {
        updateData.currentOuterCount = newCounts.currentOuterCount;
        updateData.currentPackagesCount = newCounts.currentPackagesCount;
      }
    } else if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
      newCounts = await this.getNewChannelCountsForUnitPalletAggregation(channel, qrCode);
      if (newCounts) {
        updateData.currentOuterCount = newCounts.currentOuterCount;
        updateData.currentPalletsCount = newCounts.currentPalletsCount;
      }
    }
    return await this.channelModel
      .findByIdAndUpdate(channel._id, updateData,{ new: true })
      .exec();
  }

  private async getNewChannelCountsForPackageAggregation(
    channel: ChannelDocument,
    qrCode: string
  ): Promise<{
    currentOuterCount: number;
    currentPackagesCount: number;
  } | null> {
    if (channel.sessionMode === SessionMode.PACKAGE_AGGREGATION) {
      let newCurrentOuterCount = channel.currentOuterCount || 0;
      let newCurrentPackagesCount = channel.currentPackagesCount || 0;
      
      // Check if we've reached the limit (expecting package QR now)
      if (channel.currentOuterCount === channel.outersPerPackage) {
        // Package cycle completed - reset counter and increment package count
        newCurrentOuterCount = 0;
        newCurrentPackagesCount = (channel.currentPackagesCount || 0) + 1;
        const packageOuters = channel.processedQrCodes.slice(
          -channel.outersPerPackage
        );
        console.log(packageOuters);
        this.logger.log(
          `Package completed with outers: ${packageOuters.join(", ")} and ready to send to queue.`
        );

        await this.publishAggregationEvent(
          channel._id.toString(),
          "",
          "PACKAGE_COMPLETION",
          {
            packageQr: qrCode,
            outersProcessed: packageOuters,
            cycleNumber: newCurrentPackagesCount,
          },
          null,
          MessageStatus.VALID
        );

        await this.packageUpdatePublisher.publishPackageCycleEvent(
          channel._id.toString(),
          qrCode,
          packageOuters,
          undefined, // send createQrConfigurationDto data
          channel.userId,
          {
            triggerSource: "package_reached",
            totalCompleted: newCurrentPackagesCount || 0,
          }
        );
      } else {
        // Still collecting outers - increment counter
        newCurrentOuterCount = (channel.currentOuterCount || 0) + 1;
      }
      
      return {
        currentOuterCount: newCurrentOuterCount,
        currentPackagesCount: newCurrentPackagesCount,
      };
    }
    return null;
  }

  private async getNewChannelCountsForUnitPalletAggregation(
    channel: ChannelDocument,
    qrCode: string
  ): Promise<{
    currentOuterCount: number;
    currentPalletsCount: number;
  } | null> {
    if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
      let newCurrentOuterCount = (channel.currentOuterCount || 0) + 1;
      let newCurrentPalletsCount = channel.currentPalletsCount || 0;

      // Check if we've reached the outers per pallet limit
      if (newCurrentOuterCount >= channel.outersPerPallet) {
        // Pallet cycle completed
        newCurrentOuterCount = 0;
        newCurrentPalletsCount = (channel.currentPalletsCount || 0) + 1;
        
        // Get the outers for this completed pallet cycle
        const palletOuters = [
          ...channel.processedQrCodes.slice(-(channel.outersPerPallet - 1)),
          qrCode
        ];
        
        this.logger.log(
          `Pallet cycle ${newCurrentPalletsCount} completed with outers: ${palletOuters.join(", ")} for pallet ${qrCode}`
        );

        // Publish pallet cycle event (similar to package cycle)
        await this.publishAggregationEvent(
          channel._id.toString(),
          "",
          "PALLET_COMPLETION",
          {
            palletQr: qrCode,
            outersProcessed: palletOuters,
            cycleNumber: newCurrentPalletsCount,
          },
          null,
          MessageStatus.VALID
        );

        // Publish RabbitMQ event for pallet cycle completion (matching PACKAGE_AGGREGATION behavior)
        await this.packageUpdatePublisher.publishPackageCycleEvent(
          channel._id.toString(),
          qrCode,
          palletOuters,
          undefined, // send createQrConfigurationDto data
          channel.userId,
          {
            triggerSource: "pallet_reached",
            totalCompleted: newCurrentPalletsCount,
          }
        );
      }

      return {
        currentOuterCount: newCurrentOuterCount,
        currentPalletsCount: newCurrentPalletsCount,
      };
    }
    return null;
  }

  // ============ PALLET AGGREGATION HELPER METHODS ============

  /**
   * Configure unit pallet counters (outers being aggregated directly into a pallet)
   */
  private async configureUnitPalletCounters(
    palletQr: QrCodeDocument,
    outerQr: QrCodeDocument | null,
    product: ProductDocument | null,
    channel: ChannelDocument
  ) {
    if (!outerQr || !product) return;

    // Fetch the latest outer QR data to ensure we have the configured productData
    const latestOuterQr = await this.qrCodeModel.findById(outerQr._id).exec();
    if (!latestOuterQr) {
      this.logger.warn(`Could not fetch latest data for outer QR: ${outerQr.value}`);
      return;
    }

    // Calculate counters from all processed outer QRs in the channel
    let counter = 0;
    let outers = 0;
    
    if (channel.processedQrCodes && channel.processedQrCodes.length > 0) {
      // Fetch all processed outer QRs to get their counter values
      const processedOuterQrs = await this.qrCodeModel
        .find({ value: { $in: channel.processedQrCodes } })
        .exec();
      
      // Sum up counters from all outer QRs
      processedOuterQrs.forEach((qr) => {
        if (qr.productData && qr.productData.length > 0) {
          qr.productData.forEach((pd) => {
            if (pd.productId === product._id.toString()) {
              counter += pd.counter || 0;
            }
          });
        }
      });
      
      outers = processedOuterQrs.length; // Each processed QR is an outer
    }

    // Add product data with pallet-level counters
    const productData: ProductData = {
      productId: product._id.toString(),
      counter: counter,
      packages: undefined, // Not applicable for unit pallet aggregation
      outers: outers, // Direct aggregation of outers to pallet
      pallets: 1, // This pallet contains the outers
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
      `Updated unit pallet counters for QR: ${palletQr.value} with outer: ${latestOuterQr.value} (counter: ${counter}, outers: ${outers})`
    );
  }

  /**
   * Enrich unit pallet QR with metadata from first outer QR (one-time operation)
   */
  private async enrichUnitPalletQrMetadata(
    palletQr: QrCodeDocument,
    firstOuterQr: QrCodeDocument,
    product: ProductDocument,
    channel: ChannelDocument
  ) {
    // Fetch the latest outer QR data to ensure we have the configured metadata
    const latestFirstOuterQr = await this.qrCodeModel.findById(firstOuterQr._id).exec();
    if (!latestFirstOuterQr) {
      this.logger.warn(`Could not fetch latest data for first outer QR: ${firstOuterQr.value}`);
      return;
    }

    const enrichmentData: any = {
      isConfigured: true,
      hasAgg: false, // Unit pallet does not have package aggregation
      hasPallet: true, // This IS a pallet
      configuredDate: new Date(),
      supplier: latestFirstOuterQr.supplier,
      vertical: latestFirstOuterQr.vertical,
      productType: latestFirstOuterQr.productType,
      productId: product._id,
      supplierDetails: latestFirstOuterQr.supplierDetails,
      verticalDetails: latestFirstOuterQr.verticalDetails,
      productTypeDetails: latestFirstOuterQr.productTypeDetails,
      products: latestFirstOuterQr.products,
    };

    await this.qrCodeModel
      .findByIdAndUpdate(palletQr._id, enrichmentData)
      .exec();

    this.logger.log(
      `Enriched unit pallet QR metadata: ${palletQr.value} from first outer: ${latestFirstOuterQr.value}`
    );
  }

  /**
   * Update relationships for unit pallet aggregation (outers -> pallet directly)
   */
  private async updateUnitPalletRelationships(
    palletQr: QrCodeDocument,
    outerQr: QrCodeDocument | null
  ) {
    if (!outerQr) return;

    // Update child OUTER QR code to set its direct parent as the pallet
    await this.qrCodeModel
      .findByIdAndUpdate(outerQr._id, {
        directParent: palletQr.value,
        $addToSet: { parents: palletQr.value },
      })
      .exec();

    this.logger.log(
      `Updated unit pallet relationships: ${outerQr.value} -> ${palletQr.value} (direct outer to pallet)`
    );
  }

  /**
   * Process a validated message for unit pallet aggregation through Phase 2A and 3 (Phase 2B handled separately)
   */
  private async processValidatedUnitPalletMessage(
    message: ChannelMessage,
    channel: ChannelDocument,
    palletQr: QrCodeDocument
  ): Promise<void> {
    const { aggregationData } = message;
    if (!aggregationData) return;

    // Find the outer QR and fetch the latest data (after async configuration)
    const outerQr = aggregationData.childQrCode
      ? await this.qrCodeModel
          .findOne({ value: aggregationData.childQrCode })
          .exec()
      : null;

    if (!outerQr) {
      this.logger.warn(`Outer QR not found: ${aggregationData.childQrCode}`);
      return;
    }

    // Fetch product from the configured outer QR's productData
    let product: ProductDocument | null = null;
    if (outerQr.productData && outerQr.productData.length > 0) {
      product = await this.productModel
        .findById(outerQr.productData[0].productId)
        .exec();
    }

    // If product is still not found, try to get it from the channel
    if (!product) {
      product = await this.productModel.findById(channel.productId).exec();
    }

    // Phase 2A: Update counters and product data (per outer)
    await this.configureUnitPalletCounters(palletQr, outerQr, product, channel);

    // Phase 3: Relationship Update (per outer)
    await this.updateUnitPalletRelationships(palletQr, outerQr);

    // Update message status to completed
    await this.updateMessageStatus(message._id, MessageStatus.VALID);

    // Publish configuration completed event
    await this.publishAggregationEvent(
      channel._id.toString(),
      message._id.toString(),
      "CONFIGURATION_COMPLETED",
      {
        targetQr: palletQr.value,
        outerQr: outerQr?.value,
        product: product?._id,
      },
      null,
      MessageStatus.VALID
    );

    this.logger.log(
      `Successfully configured unit pallet QR: ${palletQr.value} with outer: ${outerQr?.value}`
    );
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
        outerQrs.map(outerQr =>
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
      } else if (channel.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
        console.log("Session mode is UNIT_PALLET_AGGREGATION");
        
        return await this.finalizeUnitPalletAggregation(
          channelId,
          channel,
          startTime
        );
      } else if (channel.sessionMode === SessionMode.SCANNER) {
        return await this.finalizeScannerAggregation(
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
    // Prevent finalization if there are unprocessed outers
    if (channel.currentOuterCount && channel.currentOuterCount !== 0) {
      throw new Error(
        `Cannot finalize channel: There are still ${channel.currentOuterCount} outers remaining to be processed.`
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
    const processedOutersCount = channel.outersPerPackage * channel.currentPackagesCount
    // Publish session closed event
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: processedOutersCount,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized package aggregation channel ${channelId} with ${processedOutersCount} processed messages in ${executionTime}ms`
    );
    return updatedChannel;
  }

  /**
   * Finalize unit pallet aggregation channel (outer QRs directly to pallet)
   */
  private async finalizeUnitPalletAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {
    // Prevent finalization if there are unprocessed outers (similar to PACKAGE_AGGREGATION)
    if (channel.currentOuterCount && channel.currentOuterCount !== 0) {
      throw new Error(
        `Cannot finalize channel: There are still ${channel.currentOuterCount} outers remaining to be processed for the current pallet cycle.`
      );
    }

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
      // Find the pallet QR from processedQrCodes (last COMPOSED QR scanned)
      // Get all COMPOSED QRs from processed QR codes
      const palletQrs = await this.qrCodeModel
        .find({ 
          value: { $in: channel.processedQrCodes },
          kind: QrCodeKind.COMPOSED 
        })
        .exec();
      
      const targetQr = palletQrs.length > 0 ? palletQrs[palletQrs.length - 1] : null;

      if (!targetQr) {
        throw new Error(
          `Pallet QR code not found in processed QR codes during finalization`
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
        await this.enrichUnitPalletQrMetadata(
          targetQr,
          firstOuterQr,
          firstProduct,
          channel
        );
      }

      // Process each validated message through Phase 2A and Phase 3
      await Promise.all(
        validatedMessages.map((message) =>
          this.processValidatedUnitPalletMessage(message, channel, targetQr)
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

    const processedOutersCount = channel.outersPerPallet * channel.currentPalletsCount;
    // Publish session closed event
    await this.publishAggregationEvent(
      channelId,
      "",
      "SESSION_CLOSED",
      {
        status: ChannelStatus.FINALIZED,
        processedCount: processedOutersCount,
        palletsCompleted: channel.currentPalletsCount,
      },
      null,
      MessageStatus.VALID
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    this.logger.log(
      `Successfully finalized unit pallet aggregation channel ${channelId} with ${processedOutersCount} processed outers in ${channel.currentPalletsCount} pallet cycles in ${executionTime}ms`
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
   * Finalize SCANNER mode channel (real-time QR configuration tracking)
   */
  private async finalizeScannerAggregation(
    channelId: string,
    channel: ChannelDocument,
    startTime: number
  ): Promise<Channel> {

    

    // Get all processed messages for this SCANNER session
    const processedMessages = await this.channelMessageModel
      .find({
        channelId,
        status: { $in: [MessageStatus.VALID, MessageStatus.CONFIGURED_SUCCESSFULLY] },
      })
      .exec();

    // Count successful configurations vs validation errors
    const successfulConfigurations = processedMessages.filter(
      msg => msg.status === MessageStatus.CONFIGURED_SUCCESSFULLY
    ).length;

    const validationErrors = await this.channelMessageModel
      .countDocuments({
        channelId,
        status: { $in: [
          MessageStatus.ALREADY_CONFIGURED,
          MessageStatus.NOT_FOUND,
          MessageStatus.WRONG_TYPE,
          MessageStatus.PRODUCT_NOT_FOUND,
          MessageStatus.VALIDATION_ERROR,
          MessageStatus.DUPLICATE_IN_SESSION
        ] }
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
              finalizedAt: new Date()
            }
          }
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

    /**
     * I comment this part because now we can have multiple open channels that have no targetQrCode
     */

    // validate targetQrCode is not used in other open channels if then return the old one
    // const existingChannel = await this.channelModel
    //   .findOne({
    //     targetQrCode: input.targetQrCode,
    //     status: ChannelStatus.OPEN,
    //   })
    //   .exec();
    // if (existingChannel) {
    //   this.logger.log(
    //     `Reusing existing open channel for target QR: ${input.targetQrCode}`
    //   );
    //   return existingChannel;
    // }
    
    // validate targetQrCode based on session mode
    let validationResult;
    const product = await this.productModel.findById(input.productId).exec();
    if (!product) {
      throw new Error(`Product with ID '${input.productId}' not found`);
    }
    
    if (input.sessionMode === SessionMode.PACKAGE_AGGREGATION) {

      if(!product.numberOfPacking|| product.numberOfPacking <= 0) {
        throw new Error(
          `numberOfPacking must be greater than 0 for PACKAGE_AGGREGATION mode in the current product`
        );
      }
    } else if (input.sessionMode === SessionMode.PALLET_AGGREGATION) {
      validationResult = await this.validateTargetPalletForAggregation(
        input.targetQrCode
      );
    } else if (input.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
      // Validate product has outersPerPallet configured for cycle tracking
      if (!product?.numberOfPacking || product.numberOfPacking <= 0) {
        throw new Error(
          `numberOfPacking must be greater than 0 for UNIT_PALLET_AGGREGATION mode to support cycle tracking`
        );
      }
      
      this.logger.log(`Starting UNIT_PALLET_AGGREGATION mode session for pallet ${input.targetQrCode} with ${product.numberOfPacking} outers per pallet cycle`);
    } else if (input.sessionMode === SessionMode.SCANNER) {
      // This mode is used for real-time QR validation and configuration without aggregation
      this.logger.log(`Starting SCANNER mode session for product ${product.name} (${product._id})`);
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
      targetQrCode: input.sessionMode === SessionMode.SCANNER ? null : (input.targetQrCode || undefined),
      processedQrCodes: [],
    };

    if (input.sessionMode=== SessionMode.PACKAGE_AGGREGATION){
      channelData.outersPerPackage = product?.numberOfPacking;
      channelData.currentOuterCount = 0;
      channelData.currentPackagesCount = 0;
    }

    // Add UNIT_PALLET_AGGREGATION specific fields for cycle tracking
    if (input.sessionMode === SessionMode.UNIT_PALLET_AGGREGATION) {
      channelData.outersPerPallet = product?.numberOfPacking;
      channelData.currentOuterCount = 0;
      channelData.currentPalletsCount = 0;
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
      
      this.logger.log(`SCANNER mode configured for product: ${product.name} (${product._id})`);
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
