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
import { MessageStatus, ChannelStatus, SessionMode, ChannelEventKind } from "../common/enums";
import { PackageAggregationEvent } from "./channel.types";
import { StartPackageAggregationInput } from "./dto/package-aggregation.input";

@Injectable()
export class PackageAggregationService {
  private readonly logger = new Logger(PackageAggregationService.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(ChannelMessage.name)
    private channelMessageModel: Model<ChannelMessageDocument>,
    private readonly pubSubService: PubSubService
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
      // Phase 1: Validation
      const validationResult = await this.validateOutersForAggregation(input, channel);

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
          validationResult.errorMessage
        );
        // Refresh message from DB to get latest status
        message = await this.channelMessageModel
          .findById(message._id)
          .populate("channelId")
          .exec();

        return message;
      }

      // Update message with validation success (but not fully processed yet)
      await this.updateMessageStatus(message._id, MessageStatus.PROCESSING);
      await this.addProcessedQrToChannel(input.channelId, input.outerQrCode);

      // Publish validation completed event
      await this.publishAggregationEvent(
        input.channelId,
        message._id.toString(),
        "VALIDATION_COMPLETED",
        {
          targetQr: channel.targetQrCode,
          outerQr: validationResult.outerQr?.value,
          product: validationResult.product?._id,
        }
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
        error.message
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
    const messageContent = `Package aggregation: ${channel.targetQrCode}${input.outerQrCode ? ` -> ${input.outerQrCode}` : ""}`;

    const message = new this.channelMessageModel({
      content: messageContent,
      author: input.author,
      channelId: input.channelId,
      status: MessageStatus.PROCESSING,
      aggregationData: {
        targetQr: channel.targetQrCode,
        outerQrCode: input.outerQrCode,
        eventType: input.eventType,
        metadata: input.metadata,
      },
    });

    return await message.save();
  }

  /**
   * Phase 1: Validation of OUTER QR codes for aggregation
   */
  private async validateOutersForAggregation(
    input: ProcessAggregationMessageInput,
    channel: ChannelDocument
  ) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.outerQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.outerQrCode} has already been processed in this session`,
      };
    }


    let outerQr: QrCodeDocument | null = null;
    let product: ProductDocument | null = null;

    // If OUTER QR code is provided, validate it
    if (input.outerQrCode) {
      outerQr = await this.qrCodeModel
        .findOne({ value: input.outerQrCode })
        .exec();
      if (!outerQr) {
        return {
          isValid: false,
          status: MessageStatus.NOT_FOUND,
          errorMessage: `OUTER QR code '${input.outerQrCode}' not found`,
        };
      }

      // Validate QR type is OUTER
      if (outerQr.type !== QrCodeTypeGenerator.OUTER) {
        return {
          isValid: false,
          status: MessageStatus.WRONG_TYPE,
          errorMessage: `QR code '${input.outerQrCode}' is not of type OUTER`,
        };
      }

      // Validate OUTER QR is configured
      if (!outerQr.isConfigured) {
        return {
          isValid: false,
          status: MessageStatus.NOT_CONFIGURED,
          errorMessage: `OUTER QR code '${input.outerQrCode}' is not configured`,
        };
      }

      // validate OUTER QR is not already aggregated
      if (outerQr.directParent || outerQr.parents.length > 0) {
        return {
          isValid: false,
          status: MessageStatus.ALREADY_AGGREGATED,
          errorMessage: `OUTER QR code '${input.outerQrCode}' has already been aggregated`,
        };
      }

      // Get product information from OUTER QR
      if (outerQr.productData && outerQr.productData.length > 0) {
        product = await this.productModel
          .findById(outerQr.productData[0].productId)
          .exec();
      }

      if (!product) {
        return {
          isValid: false,
          status: MessageStatus.PRODUCT_NOT_FOUND,
          errorMessage: `Product not found for OUTER QR code '${input.outerQrCode}'`,
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

      // Validate product type consistency (placeholder logic)
      // You would implement your specific product type validation here
    }

    return {
      isValid: true,
      outerQr,
      product,
    };
  }

  /**
   * Phase 1: Validation of TARGET QR codes for aggregation
   */
  private async validateTargetForAggregation(
    targetQrCode: string,
  ) {

        // Find and validate target COMPOSED QR code
    const targetQr = await this.qrCodeModel
      .findOne({ value: targetQrCode })
      .exec();
    if (!targetQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `COMPOSED QR code '${targetQrCode}' not found`,
      };
    }

    // Validate QR type is COMPOSED
    if (targetQr.kind !== QrCodeKind.COMPOSED) {
      // Assuming COMPOSED maps to OUTER for now
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${targetQrCode}' is not of type COMPOSED`,
      };
    }

    // Validate QR is not yet configured
    if (targetQr.isConfigured) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_CONFIGURED,
        errorMessage: `QR code '${targetQrCode}' is already configured`,
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
      pd => pd.productId === product._id.toString()
    );
    
    if (existingIndex >= 0) {
      // Update existing product data
      existingProductData[existingIndex] = productData;
    } else {
      // Add new product data
      existingProductData.push(productData);
    }

    await this.qrCodeModel.findByIdAndUpdate(targetQr._id, {
      productData: existingProductData,
    }).exec();

    this.logger.debug(`Updated counters for QR: ${targetQr.value} with outer: ${outerQr.value}`);
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
      hasAgg: false,
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

    await this.qrCodeModel.findByIdAndUpdate(targetQr._id, enrichmentData).exec();

    this.logger.log(`Enriched target QR metadata: ${targetQr.value} from first outer: ${firstOuterQr.value}`);
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
   * Publish aggregation event
   */
  private async publishAggregationEvent(
    channelId: string,
    messageId: string,
    eventType: PackageAggregationEvent["eventType"],
    data?: any,
    error?: string
  ): Promise<void> {
    const event: PackageAggregationEvent = {
      channelId,
      messageId,
      eventType,
      data,
      error,
    };

    await this.pubSubService.publishPackageAggregationEvent(event);
  }

  /**
   * Finalize channel - handles Phase 2 (Configuration), Phase 3 (Relationship Update), and channel closure
   */
  async finalizeChannel(channelId: string): Promise<Channel> {
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
      // Get all validated messages from this channel that need configuration
      const validatedMessages = await this.channelMessageModel
        .find({
          channelId,
          status: MessageStatus.PROCESSING,
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
          throw new Error(`Target QR code '${channel.targetQrCode}' not found during finalization`);
        }

        // Find first outer QR for enrichment
        const firstMessage = validatedMessages[0];
        const firstOuterQr = firstMessage.aggregationData?.outerQrCode
          ? await this.qrCodeModel.findOne({ value: firstMessage.aggregationData.outerQrCode }).exec()
          : null;

        let firstProduct: ProductDocument | null = null;
        if (firstOuterQr && firstOuterQr.productData && firstOuterQr.productData.length > 0) {
          firstProduct = await this.productModel
            .findById(firstOuterQr.productData[0].productId)
            .exec();
        }

        // Phase 2B: One-time enrichment with metadata from first outer QR
        if (firstOuterQr && firstProduct) {
          await this.enrichPackageQrMetadata(targetQr, firstOuterQr, firstProduct, channel);
        }

        // Process each validated message through Phase 2A and Phase 3
        await Promise.all(validatedMessages.map(message => this.processValidatedMessage(message, channel, targetQr)));
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
      await this.publishAggregationEvent(channelId, "", "SESSION_CLOSED", {
        status: ChannelStatus.FINALIZED,
        processedCount: validatedMessages.length,
      });

      this.logger.log(
        `Successfully finalized channel ${channelId} with ${validatedMessages.length} processed messages`
      );
      return updatedChannel;
    } catch (error) {
      this.logger.error(
        `Failed to finalize channel: ${error.message}`,
        error.stack
      );
      await this.publishAggregationEvent(
        channelId,
        "",
        "ERROR",
        null,
        error.message
      );
      throw error;
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
    const outerQr = aggregationData.outerQrCode
      ? await this.qrCodeModel
          .findOne({ value: aggregationData.outerQrCode })
          .exec()
      : null;

    let product: ProductDocument | null = null;
    if (outerQr && outerQr.productData && outerQr.productData.length > 0) {
      product = await this.productModel
        .findById(outerQr.productData[0].productId)
        .exec();
    }

    // Phase 2A: Update counters and product data (per outerQr)
    await this.configurePackageCounters(
      targetQr,
      outerQr,
      product,
      channel
    );

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
      }
    );

    this.logger.log(`Successfully configured QR: ${targetQr.value} with outer: ${outerQr?.value}`);
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
      await this.publishAggregationEvent(channelId, "", "SESSION_CLOSED", {
        status,
      });
    }

    return updatedChannel;
  }

    // Package Aggregation methods
    async startPackageAggregation(input: StartPackageAggregationInput): Promise<Channel> {
  
      // validate targetQrCode
      const validationResult = await this.validateTargetForAggregation(input.targetQrCode);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errorMessage);
      }
  
      const createdChannel = new this.channelModel({
        ...input,
        status: ChannelStatus.OPEN,
        sessionMode: SessionMode.PACKAGE_AGGREGATION,
        targetQrCode: input.targetQrCode,
        processedQrCodes: [],
      });
      const savedChannel = await createdChannel.save();
      
      // Publish channel event
      await this.pubSubService.publishChannelEvent({
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
      }, ChannelEventKind.CREATED);
      
      return savedChannel;
    }
  
}
