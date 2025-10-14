import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QrCode, QrCodeDocument, QrCodeTypeGenerator, ProductData, QrCodeKind } from '../models/qr-code.entity';
import { Product, ProductDocument } from '../models/product.entity';
import { ChannelMessage, ChannelMessageDocument } from './channel-message.schema';
import { Channel, ChannelDocument } from './channel.schema';
import { PubSubService } from './pubsub.service';
import { ProcessAggregationMessageInput } from './dto/package-aggregation.input';
import { MessageStatus, ChannelStatus } from '../common/enums';
import { PackageAggregationEvent } from './channel.types';

@Injectable()
export class PackageAggregationService {
  private readonly logger = new Logger(PackageAggregationService.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(ChannelMessage.name) private channelMessageModel: Model<ChannelMessageDocument>,
    private readonly pubSubService: PubSubService,
  ) {}

  /**
   * Process package aggregation message with validation, configuration, and relationship updates
   */
  async processAggregationMessage(input: ProcessAggregationMessageInput): Promise<ChannelMessage> {
    this.logger.log(`Processing aggregation message for channel ${input.channelId}`);

    // Validate channel exists and is in correct state
    const channel = await this.validateChannel(input.channelId);
    
    // Create initial message with processing status
    const message = await this.createInitialMessage(input);

    try {
      // Phase 1: Validation
      const validationResult = await this.validateAggregation(input, channel);

      if (!validationResult.isValid) {
        await this.updateMessageStatus(message._id, validationResult.status, validationResult.errorMessage);
        await this.publishAggregationEvent(input.channelId, message._id.toString(), 'ERROR', null, validationResult.errorMessage);
        return message;
      }

      // Phase 2: Configuration
      const configurationResult = await this.configurePackageQr(
        validationResult.composedQr,
        validationResult.outerQr,
        validationResult.product,
        channel
      );

      // Phase 3: Relationship Update
      await this.updateRelationships(validationResult.composedQr, validationResult.outerQr);

      // Update message with success
      await this.updateMessageStatus(message._id, MessageStatus.VALID);
      await this.addProcessedQrToChannel(input.channelId, input.composedQrCode);

      // Publish success event
      await this.publishAggregationEvent(
        input.channelId,
        message._id.toString(),
        'CONFIGURATION_COMPLETED',
        {
          composedQr: validationResult.composedQr.value,
          outerQr: validationResult.outerQr?.value,
          product: validationResult.product._id,
        }
      );

      this.logger.log(`Successfully processed aggregation for QR: ${input.composedQrCode}`);
      return await this.channelMessageModel.findById(message._id).populate('channelId').exec();

    } catch (error) {
      this.logger.error(`Failed to process aggregation message: ${error.message}`, error.stack);
      await this.updateMessageStatus(message._id, MessageStatus.ERROR, error.message);
      await this.publishAggregationEvent(input.channelId, message._id.toString(), 'ERROR', null, error.message);
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

    if (channel.status === ChannelStatus.CLOSED || channel.status === ChannelStatus.FINALIZED) {
      throw new Error(`Channel is ${channel.status.toLowerCase()} and cannot accept new messages`);
    }

    return channel;
  }

  /**
   * Create initial message with processing status
   */
  private async createInitialMessage(input: ProcessAggregationMessageInput): Promise<ChannelMessage> {
    const messageContent = `Package aggregation: ${input.composedQrCode}${input.outerQrCode ? ` -> ${input.outerQrCode}` : ''}`;
    
    const message = new this.channelMessageModel({
      content: messageContent,
      author: input.author,
      channelId: input.channelId,
      status: MessageStatus.PROCESSING,
      aggregationData: {
        composedQrCode: input.composedQrCode,
        outerQrCode: input.outerQrCode,
        eventType: input.eventType,
        metadata: input.metadata,
      },
    });

    return await message.save();
  }

  /**
   * Phase 1: Validation
   */
  private async validateAggregation(input: ProcessAggregationMessageInput, channel: ChannelDocument) {
    // Check for duplicate in session
    if (channel.processedQrCodes.includes(input.composedQrCode)) {
      return {
        isValid: false,
        status: MessageStatus.DUPLICATE_IN_SESSION,
        errorMessage: `QR code ${input.composedQrCode} has already been processed in this session`,
      };
    }

    // Find and validate COMPOSED QR code
    const composedQr = await this.qrCodeModel.findOne({ value: input.composedQrCode }).exec();
    if (!composedQr) {
      return {
        isValid: false,
        status: MessageStatus.NOT_FOUND,
        errorMessage: `COMPOSED QR code '${input.composedQrCode}' not found`,
      };
    }

    // Validate QR type is COMPOSED
    if (composedQr.kind !== QrCodeKind.COMPOSED) { // Assuming COMPOSED maps to OUTER for now
      return {
        isValid: false,
        status: MessageStatus.WRONG_TYPE,
        errorMessage: `QR code '${input.composedQrCode}' is not of type COMPOSED`,
      };
    }

    // Validate QR is not yet configured
    if (composedQr.isConfigured) {
      return {
        isValid: false,
        status: MessageStatus.ALREADY_CONFIGURED,
        errorMessage: `QR code '${input.composedQrCode}' is already configured`,
      };
    }

    let outerQr: QrCodeDocument | null = null;
    let product: ProductDocument | null = null;

    // If OUTER QR code is provided, validate it
    if (input.outerQrCode) {
      outerQr = await this.qrCodeModel.findOne({ value: input.outerQrCode }).exec();
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

      // Get product information from OUTER QR
      if (outerQr.productData && outerQr.productData.length > 0) {
        product = await this.productModel.findById(outerQr.productData[0].productId).exec();
      }

      if (!product) {
        return {
          isValid: false,
          status: MessageStatus.PRODUCT_NOT_FOUND,
          errorMessage: `Product not found for OUTER QR code '${input.outerQrCode}'`,
        };
      }

      // Validate product type consistency (placeholder logic)
      // You would implement your specific product type validation here
    }

    return {
      isValid: true,
      composedQr,
      outerQr,
      product,
    };
  }

  /**
   * Phase 2: Configuration
   */
  private async configurePackageQr(
    composedQr: QrCodeDocument,
    outerQr: QrCodeDocument | null,
    product: ProductDocument | null,
    channel: ChannelDocument
  ) {
    const updateData: any = {
      isConfigured: true,
      hasAgg: false,
      hasPallet: false,
      configuredDate: new Date(),
    };

    if (outerQr && product) {
      // Add product data with package-level counters
      const productData: ProductData = {
        productId: product._id.toString(),
        counter: 1,
        packages: 1, // This is a package-level aggregation
        outers: outerQr.productData?.[0]?.counter || 1,
        pallets: undefined,
      };

      updateData.productData = [productData];

      // Inherit configuration fields from child OUTER QR
      updateData.supplier = outerQr.supplier;
      updateData.vertical = outerQr.vertical;
      updateData.productType = outerQr.productType;
      updateData.productId = product._id;
      updateData.supplierDetails = outerQr.supplierDetails;
      updateData.verticalDetails = outerQr.verticalDetails;
      updateData.productTypeDetails = outerQr.productTypeDetails;
    }

    await this.qrCodeModel.findByIdAndUpdate(composedQr._id, updateData).exec();
    
    return updateData;
  }

  /**
   * Phase 3: Relationship Update
   */
  private async updateRelationships(composedQr: QrCodeDocument, outerQr: QrCodeDocument | null) {
    if (!outerQr) return;

    // Update child OUTER QR code to set its direct parent
    await this.qrCodeModel.findByIdAndUpdate(outerQr._id, {
      directParent: composedQr.value,
      $addToSet: { parents: composedQr.value },
    }).exec();

    this.logger.log(`Updated relationships: ${outerQr.value} -> ${composedQr.value}`);
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

    await this.channelMessageModel.findByIdAndUpdate(messageId, updateData).exec();
  }

  /**
   * Add processed QR code to channel
   */
  private async addProcessedQrToChannel(channelId: string, qrCode: string): Promise<void> {
    await this.channelModel.findByIdAndUpdate(channelId, {
      $addToSet: { processedQrCodes: qrCode },
    }).exec();
  }

  /**
   * Publish aggregation event
   */
  private async publishAggregationEvent(
    channelId: string,
    messageId: string,
    eventType: PackageAggregationEvent['eventType'],
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
   * Update channel status
   */
  async updateChannelStatus(channelId: string, status: ChannelStatus): Promise<Channel> {
    const updatedChannel = await this.channelModel.findByIdAndUpdate(
      channelId,
      { status },
      { new: true }
    ).exec();

    if (!updatedChannel) {
      throw new Error(`Channel with ID '${channelId}' not found`);
    }

    // Publish event when session is closed/finalized
    if (status === ChannelStatus.CLOSED || status === ChannelStatus.FINALIZED) {
      await this.publishAggregationEvent(channelId, '', 'SESSION_CLOSED', { status });
    }

    return updatedChannel;
  }
}