import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QrCode, QrCodeDocument, ProductData } from '../../models/qr-code.entity';
import { Product, ProductDocument } from '../../models/product.entity';
import { Channel, ChannelDocument } from '../../channel/channel.schema';
import { ChannelMessage, ChannelMessageDocument } from '../../channel/channel-message.schema';
import { RabbitMQConnectionService } from '../services/rabbitmq-connection.service';
import {
  PackageUpdateEvent,
  PackageUpdateResult,
  PackageCycleEvent,
  PackageCycleResult,
  PACKAGE_UPDATE_QUEUE_NAMES,
  PACKAGE_UPDATE_ROUTING_KEYS,
  PACKAGE_UPDATE_EXCHANGE_NAMES,
} from '../interfaces/package-update.interface';
import { ConsumeMessage } from 'amqplib';
import { MessageStatus } from '../../common/enums';
import { ConfigurationService } from '@/configuration/configuration.service';
import { CreateQrConfigrationDto } from '@/configuration/dto/create-qr-configration.dto';

@Injectable()
export class PackageUpdateConsumer implements OnModuleInit {
  private readonly logger = new Logger(PackageUpdateConsumer.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(ChannelMessage.name) private channelMessageModel: Model<ChannelMessageDocument>,
      private readonly configurationService: ConfigurationService,
    private readonly rabbitMQConnection: RabbitMQConnectionService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.rabbitMQConnection.initialize();
      await this.initializeConsumer();
      this.logger.log('Package update consumer initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize package update consumer: ${error.message}`, error.stack);
    }
  }

  /**
   * Initialize RabbitMQ consumer for package update events
   */
  private async initializeConsumer(): Promise<void> {
    try {
      const channel = this.rabbitMQConnection.getConsumerChannel();
      
      // Start consuming messages from the package update queue
      await channel.consume(
        PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE,
        (message: ConsumeMessage | null) => {
          if (message) {
            // Route to appropriate handler based on routing key
            const routingKey = message.fields.routingKey;
            if (routingKey === PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_REQUEST) {
              this.handlePackageCycleEvent(message, channel);
            } else {
              this.handlePackageUpdateEvent(message, channel);
            }
          }
        },
        {
          noAck: false, // Require manual acknowledgment
        }
      );

      this.logger.log('Started consuming package update events');
    } catch (error) {
      this.logger.error(`Failed to initialize package update consumer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle package update event from RabbitMQ
   * This consolidates enrichPackageQrMetadata and processValidatedMessage logic
   */
  private async handlePackageUpdateEvent(message: ConsumeMessage, channel: any): Promise<void> {
    const startTime = Date.now();
    let event: PackageUpdateEvent;

    try {
      // Parse the message content
      const content = message.content.toString();
      event = JSON.parse(content);
      
      this.logger.log(
        `Processing package update event ${event.eventId} for channel: ${event.channelId} with ${event.messageIds.length} messages`
      );

      const result = await this.processPackageUpdate(event);
      
      // Publish result event
      await this.publishPackageUpdateResult(result);
      
      // Acknowledge message only after successful processing
      channel.ack(message);
      
      this.logger.log(
        `Successfully processed package update event ${event.eventId} in ${Date.now() - startTime}ms`
      );

    } catch (error) {
      const processingDuration = Date.now() - startTime;
      
      this.logger.error(
        `Failed to process package update event ${event?.eventId || 'unknown'}: ${error.message}`,
        error.stack
      );

      // Publish failure result
      if (event) {
        const failureResult: PackageUpdateResult = {
          eventId: event.eventId,
          channelId: event.channelId,
          success: false,
          processedMessageCount: 0,
          processedAt: new Date(),
          processingDuration,
          errorMessage: error.message,
        };
        await this.publishPackageUpdateResult(failureResult);
      }

      // Determine if message should be retried or sent to DLQ
      const retryCount = this.getRetryCount(message);
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        // Reject and requeue for retry
        this.logger.warn(`Rejecting message for retry (attempt ${retryCount + 1}/${maxRetries})`);
        channel.nack(message, false, true);
      } else {
        // Max retries reached, reject without requeue (sends to DLQ if configured)
        this.logger.error(`Max retries reached for event ${event?.eventId}, rejecting message`);
        channel.nack(message, false, false);
      }
    }
  }

  /**
   * Handle package cycle event from RabbitMQ (NEW WORKFLOW)
   * This processes a package QR and its associated outers in real-time
   */
  private async handlePackageCycleEvent(message: ConsumeMessage, channel: any): Promise<void> {
    const startTime = Date.now();
    let event: PackageCycleEvent;

    try {
      // Parse the message content
      const content = message.content.toString();
      event = JSON.parse(content);
      
      this.logger.log(
        `Processing package cycle event ${event.eventId} for channel: ${event.channelId}, package: ${event.packageQrCode}`
      );

      const result = await this.processPackageCycle(event);
      
      // Publish result event
      await this.publishPackageCycleResult(result);
      
      // Acknowledge message only after successful processing
      channel.ack(message);
      
      this.logger.log(
        `Successfully processed package cycle event ${event.eventId} in ${Date.now() - startTime}ms`
      );

    } catch (error) {
      const processingDuration = Date.now() - startTime;
      
      this.logger.error(
        `Failed to process package cycle event ${event?.eventId || 'unknown'}: ${error.message}`,
        error.stack
      );

      // Publish failure result
      if (event) {
        const failureResult: PackageCycleResult = {
          eventId: event.eventId,
          channelId: event.channelId,
          packageQrCode: event.packageQrCode,
          success: false,
          processedOuterCount: 0,
          processedAt: new Date(),
          processingDuration,
          errorMessage: error.message,
        };
        await this.publishPackageCycleResult(failureResult);
      }

      // Determine if message should be retried or sent to DLQ
      const retryCount = this.getRetryCount(message);
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        // Reject and requeue for retry
        this.logger.warn(`Rejecting message for retry (attempt ${retryCount + 1}/${maxRetries})`);
        channel.nack(message, false, true);
      } else {
        // Max retries reached, reject without requeue (sends to DLQ if configured)
        this.logger.error(`Max retries reached for event ${event?.eventId}, rejecting message`);
        channel.nack(message, false, false);
      }
    }
  }

  /**
   * Process the package update event - consolidates all the extracted logic
   */
  private async processPackageUpdate(event: PackageUpdateEvent): Promise<PackageUpdateResult> {
    const startTime = Date.now();

    try {
      // Get channel and target QR
      const channel = await this.channelModel.findById(event.channelId).exec();
      if (!channel) {
        throw new Error(`Channel ${event.channelId} not found`);
      }

      const targetQr = await this.qrCodeModel.findOne({ value: event.targetQrCode }).exec();
      if (!targetQr) {
        throw new Error(`Target QR code '${event.targetQrCode}' not found`);
      }

      // Get all validated messages from the event
      const validatedMessages = await this.channelMessageModel
        .find({
          _id: { $in: event.messageIds },
          status: MessageStatus.VALID,
          aggregationData: { $exists: true },
        })
        .exec();

      if (validatedMessages.length === 0) {
        this.logger.warn(`No validated messages found for event ${event.eventId}`);
        return {
          eventId: event.eventId,
          channelId: event.channelId,
          success: true,
          processedMessageCount: 0,
          processedAt: new Date(),
          processingDuration: Date.now() - startTime,
        };
      }

      // Phase 1: One-time enrichment with metadata from first outer QR
      await this.performOneTimeEnrichment(targetQr, validatedMessages[0], channel);

      // Phase 2: Process each validated message (counters + relationships)
      const processedChildQrs = await this.processAllValidatedMessages(
        validatedMessages, 
        channel, 
        targetQr
      );

      return {
        eventId: event.eventId,
        channelId: event.channelId,
        success: true,
        processedMessageCount: validatedMessages.length,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
        updatedTargetQr: targetQr.value,
        updatedChildQrs: processedChildQrs,
      };

    } catch (error) {
      return {
        eventId: event.eventId,
        channelId: event.channelId,
        success: false,
        processedMessageCount: 0,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Process the package cycle event - handles real-time processing of package + outers
   * This is the new workflow for FULL_PACKAGE_AGGREGATION mode
   * Database operations (outer messages retrieval, channel updates) now handled here for async processing
   */
  private async processPackageCycle(event: PackageCycleEvent): Promise<PackageCycleResult> {
    const startTime = Date.now();

    try {
      // Get channel and package QR
      const channel = await this.channelModel.findById(event.channelId).exec();
      if (!channel) {
        throw new Error(`Channel ${event.channelId} not found`);
      }

      const packageQr = await this.qrCodeModel.findOne({ value: event.packageQrCode }).exec();
      if (!packageQr) {
        throw new Error(`Package QR code '${event.packageQrCode}' not found`);
      }

      // MOVED FROM SERVICE LAYER: Get all validated outer messages for this cycle
      const outerMessages = await this.getOutersMessageByOutersValue(event.outersQrCodes);
      console.log(outerMessages);
      
      if (outerMessages.length === 0) {
        this.logger.warn(`No outer messages found for package cycle ${event.eventId}`);
        return {
          eventId: event.eventId,
          channelId: event.channelId,
          packageQrCode: event.packageQrCode,
          success: true,
          processedOuterCount: 0,
          processedAt: new Date(),
          processingDuration: Date.now() - startTime,
        };
      }

      this.logger.log(
        `Processing package cycle for ${event.packageQrCode} with ${outerMessages.length} outer messages`
      );

      // phase 0: configure all outers qr with product data if not already done
      const product = await this.productModel.findById(channel.productId).exec();

      await this.configureOutersProductData(outerMessages, channel, product);

      // Phase 1: One-time enrichment of package QR with metadata from first outer QR
      await this.performPackageEnrichment(packageQr, outerMessages[0], channel);

      // Phase 2: Process all outer messages for this package cycle
      const processedOuterQrs = await this.processPackageCycleOuters(
        outerMessages,
        channel,
        packageQr
      );

      return {
        eventId: event.eventId,
        channelId: event.channelId,
        packageQrCode: packageQr.value,
        success: true,
        processedOuterCount: outerMessages.length,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
        updatedPackageQr: packageQr.value,
        updatedOuterQrs: processedOuterQrs,
      };

    } catch (error) {
      this.logger.error(
        `Failed to process package cycle for ${event.packageQrCode}: ${error.message}`,
        error.stack
      );
      
      return {
        eventId: event.eventId,
        channelId: event.channelId,
        packageQrCode: event.packageQrCode,
        success: false,
        processedOuterCount: 0,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Perform one-time enrichment of target QR with metadata from first outer QR
   * Extracted from enrichPackageQrMetadata
   */
  private async performOneTimeEnrichment(
    targetQr: QrCodeDocument,
    firstMessage: ChannelMessageDocument,
    channel: ChannelDocument
  ): Promise<void> {
    const firstOuterQrCode = firstMessage.aggregationData?.childQrCode;
    if (!firstOuterQrCode) return;

    const firstOuterQr = await this.qrCodeModel.findOne({ value: firstOuterQrCode }).exec();
    if (!firstOuterQr) return;

    let firstProduct: ProductDocument | null = null;
    if (firstOuterQr.productData && firstOuterQr.productData.length > 0) {
      firstProduct = await this.productModel
        .findById(firstOuterQr.productData[0].productId)
        .exec();
    }

    if (!firstProduct) return;

    // Perform enrichment
    const enrichmentData: any = {
      isConfigured: true,
      hasAgg: true,
      hasPallet: false,
      configuredDate: new Date(),
      supplier: firstOuterQr.supplier,
      vertical: firstOuterQr.vertical,
      productType: firstOuterQr.productType,
      productId: firstProduct._id,
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
   * Process all validated messages for counters and relationships
   * Extracted and consolidated from processValidatedMessage
   */
  private async processAllValidatedMessages(
    validatedMessages: ChannelMessageDocument[],
    channel: ChannelDocument,
    targetQr: QrCodeDocument
  ): Promise<string[]> {
    const processedChildQrs: string[] = [];

    // Process each message sequentially to maintain data consistency
    for (const message of validatedMessages) {
      const { aggregationData } = message;
      if (!aggregationData) continue;

      // Find the outer QR and product based on the aggregation data
      const outerQr = aggregationData.childQrCode
        ? await this.qrCodeModel.findOne({ value: aggregationData.childQrCode }).exec()
        : null;

      let product: ProductDocument | null = null;
      if (outerQr && outerQr.productData && outerQr.productData.length > 0) {
        product = await this.productModel
          .findById(outerQr.productData[0].productId)
          .exec();
      }

      if (outerQr && product) {
        // Phase 2A: Update counters and product data (per outerQr)
        await this.configurePackageCounters(targetQr, outerQr, product, channel);

        // Phase 2B: Update relationships (per outerQr)
        await this.updateRelationships(targetQr, outerQr);

        // Update message status to completed
        await this.channelMessageModel
          .findByIdAndUpdate(message._id, { status: MessageStatus.VALID })
          .exec();

        processedChildQrs.push(outerQr.value);

        this.logger.debug(
          `Successfully configured QR: ${targetQr.value} with outer: ${outerQr.value}`
        );
      }
    }

    return processedChildQrs;
  }

  /**
   * Configure package counters
   * Extracted from configurePackageCounters in PackageAggregationService
   */
  private async configurePackageCounters(
    targetQr: QrCodeDocument,
    outerQr: QrCodeDocument,
    product: ProductDocument,
    channel: ChannelDocument
  ): Promise<void> {
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
   * Update QR relationships
   * Extracted from updateRelationships in PackageAggregationService
   */
  private async updateRelationships(
    targetQr: QrCodeDocument,
    outerQr: QrCodeDocument
  ): Promise<void> {
    // Update child OUTER QR code to set its direct parent
    await this.qrCodeModel
      .findByIdAndUpdate(outerQr._id, {
        directParent: targetQr.value,
        $addToSet: { parents: targetQr.value },
      })
      .exec();

    this.logger.debug(
      `Updated relationships: ${outerQr.value} -> ${targetQr.value}`
    );
  }

  /**
   * Perform one-time enrichment of package QR with metadata from first outer QR
   * Specialized for package cycle processing
   */
  private async performPackageEnrichment(
    packageQr: QrCodeDocument,
    firstOuterMessage: ChannelMessageDocument,
    channel: ChannelDocument
  ): Promise<void> {
    
    const firstOuterQrCode = firstOuterMessage.aggregationData?.childQrCode;
    if (!firstOuterQrCode) return;

    const firstOuterQr = await this.qrCodeModel.findOne({ value: firstOuterQrCode }).exec();
    if (!firstOuterQr) return;

    let firstProduct: ProductDocument | null = null;
    if (firstOuterQr.productData && firstOuterQr.productData.length > 0) {
      firstProduct = await this.productModel
        .findById(firstOuterQr.productData[0].productId)
        .exec();
    }

    if (!firstProduct) return;

    // Perform package enrichment
    const enrichmentData: any = {
      isConfigured: true,
      hasAgg: true,
      hasPallet: false,
      configuredDate: new Date(),
      supplier: firstOuterQr.supplier,
      vertical: firstOuterQr.vertical,
      productType: firstOuterQr.productType,
      productId: firstProduct._id,
      supplierDetails: firstOuterQr.supplierDetails,
      verticalDetails: firstOuterQr.verticalDetails,
      productTypeDetails: firstOuterQr.productTypeDetails,
      products: firstOuterQr.products,
    };

    await this.qrCodeModel
      .findByIdAndUpdate(packageQr._id, enrichmentData)
      .exec();

    this.logger.log(
      `Enriched package QR metadata: ${packageQr.value} from first outer: ${firstOuterQr.value}`
    );
  }

  /**
   * Process all outer messages for a package cycle
   * Handles counters and relationships for each outer in the cycle
   */
  private async processPackageCycleOuters(
    outerMessages: ChannelMessageDocument[],
    channel: ChannelDocument,
    packageQr: QrCodeDocument
  ): Promise<string[]> {
    const processedOuterQrs: string[] = [];

    // Process each outer message sequentially to maintain data consistency
    for (const message of outerMessages) {
      const { aggregationData } = message;
      if (!aggregationData) continue;

      // Find the outer QR and product based on the aggregation data
      const outerQr = aggregationData.childQrCode
        ? await this.qrCodeModel.findOne({ value: aggregationData.childQrCode }).exec()
        : null;

      let product: ProductDocument | null = null;
      if (outerQr && outerQr.productData && outerQr.productData.length > 0) {
        product = await this.productModel
          .findById(outerQr.productData[0].productId)
          .exec();
      }

      if (outerQr && product) {
        // Phase 2A: Update counters and product data (per outerQr)
        await this.configurePackageCounters(packageQr, outerQr, product, channel);

        // Phase 2B: Update relationships (per outerQr)
        await this.updateRelationships(packageQr, outerQr);

        // Update message status to completed
        await this.channelMessageModel
          .findByIdAndUpdate(message._id, { status: MessageStatus.VALID })
          .exec();

        processedOuterQrs.push(outerQr.value);

        this.logger.debug(
          `Successfully configured package QR: ${packageQr.value} with outer: ${outerQr.value}`
        );
      }
    }

    return processedOuterQrs;
  }

  /**
   * Publish package update result to RabbitMQ
   */
  private async publishPackageUpdateResult(result: PackageUpdateResult): Promise<void> {
    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      await channel.publish(
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_RESULT,
        result,
        {
          persistent: true,
          messageId: `result-${result.eventId}`,
          timestamp: Date.now(),
          contentType: 'application/json',
        }
      );

      this.logger.debug(`Published package update result for event ${result.eventId}`);
      
    } catch (error) {
      this.logger.error(`Failed to publish package update result: ${error.message}`, error.stack);
    }
  }

  /**
   * Publish package cycle result to RabbitMQ
   */
  private async publishPackageCycleResult(result: PackageCycleResult): Promise<void> {
    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      await channel.publish(
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_RESULT,
        result,
        {
          persistent: true,
          messageId: `cycle-result-${result.eventId}`,
          timestamp: Date.now(),
          contentType: 'application/json',
          headers: {
            'x-package-cycle-result': true,
            'x-package-qr': result.packageQrCode,
            'x-processed-count': result.processedOuterCount,
          },
        }
      );

      this.logger.debug(`Published package cycle result for event ${result.eventId}`);
      
    } catch (error) {
      this.logger.error(`Failed to publish package cycle result: ${error.message}`, error.stack);
    }
  }

  /**
   * MOVED FROM SERVICE LAYER: Get validated outer messages for the current package cycle
   * Used for real-time processing when package QR is reached
   */
  private async getOutersMessageByOutersValue(outersValue:string[]): Promise<ChannelMessageDocument[]> {
    const outerMessages = await this.channelMessageModel
      .find({
        'aggregationData.childQrCode': { $in: outersValue },
        status: MessageStatus.VALID,
        aggregationData: { $exists: true },
      })
      .exec();
    return outerMessages;
  }




  /**
   * Get retry count from message headers
   */
  private getRetryCount(message: ConsumeMessage): number {
    const headers = message.properties.headers || {};
    return headers['x-retry-count'] || 0;
  }

  /**
   * Public method to manually trigger package update processing (for testing)
   */
  async processPackageUpdateEventManually(event: PackageUpdateEvent): Promise<PackageUpdateResult> {
    return this.processPackageUpdate(event);
  }

  /**
   * Public method to manually trigger package cycle processing (for testing)
   */
  async processPackageCycleEventManually(event: PackageCycleEvent): Promise<PackageCycleResult> {
    return this.processPackageCycle(event);
  }

  /**
   * MOVED FROM SERVICE LAYER: Configure product data for outer QRs if not already done
   */
  private async configureOutersProductData(
    outerMessages: ChannelMessageDocument[],
    channel: ChannelDocument,
    product?: ProductDocument
  ): Promise<void> {

    // loop through each outer message and configure product data if missing
    for (const message of outerMessages) {
      const { aggregationData } = message;
      if (!aggregationData) continue;
      const outerQrCodeValue = aggregationData.childQrCode;
      if (!outerQrCodeValue) continue;
      const outerQr = await this.qrCodeModel.findOne({ value: outerQrCodeValue }).exec();
      if (!outerQr) continue;
      // Check if product data is already configured
      if (outerQr.productData && outerQr.productData.length > 0) {
        continue; // already configured
      }

      // enshure the type of qr is OUTER
      if (outerQr.type !== 'OUTER') {
        this.logger.warn(`QR code ${outerQr.value} is not of type OUTER, skipping product data configuration`);
        continue;
      }

      // Retrieve product based on some logic (e.g., from channel or message metadata)
      const product = await this.productModel.findById(channel.productId).exec();
      if (!product) continue;

      // Configure product data for the outer QR
      await this.configurationService.applyConfiguration(
        outerQr,
        {
          hasAgg: channel.product.hasAggregation,
          numberOfAgg: channel.product.numberOfAggregations,
          productId: product._id.toString(),
          qrCode: outerQr.value,
          operationBatch: "dsf",
          workerName: "sdfdsf",
          productionsDate: 5485415154841,
          orderNum: "dsfdsf"
        },
        product
      );

      this.logger.debug(`Configured product data for outer QR: ${outerQr.value}`);
    }
  }
}