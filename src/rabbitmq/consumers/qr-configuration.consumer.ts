import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QrCode, QrCodeDocument } from '../../models/qr-code.entity';
import { Product, ProductDocument } from '../../models/product.entity';
import { ConfigurationService } from '../../configuration/configuration.service';
import { RabbitMQConnectionService } from '../services/rabbitmq-connection.service';
import {
  QrConfigurationEvent,
  QrConfigurationResult,
  QUEUE_NAMES,
  ROUTING_KEYS,
  EXCHANGE_NAMES,
} from '../interfaces/qr-configuration.interface';
import { CreateQrConfigrationDto } from '../../configuration/dto/create-qr-configration.dto';
import { ConsumeMessage } from 'amqplib';

@Injectable()
export class QrConfigurationConsumer implements OnModuleInit {
  private readonly logger = new Logger(QrConfigurationConsumer.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly configurationService: ConfigurationService,
    private readonly rabbitMQConnection: RabbitMQConnectionService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.rabbitMQConnection.initialize();
      await this.initializeConsumer();
      this.logger.log('QR Configuration consumer initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize QR configuration consumer: ${error.message}`, error.stack);
    }
  }

  /**
   * Initialize RabbitMQ consumer for QR configuration events
   */
  private async initializeConsumer(): Promise<void> {
    try {
      const channel = this.rabbitMQConnection.getConsumerChannel();
      
      // Start consuming messages from the QR configuration queue
      await channel.consume(
        QUEUE_NAMES.QR_CONFIGURATION,
        (message: ConsumeMessage | null) => {
          if (message) {
            this.handleQrConfigurationEvent(message, channel);
          }
        },
        {
          noAck: false, // Require manual acknowledgment
        }
      );

      this.logger.log('Started consuming QR configuration events');
    } catch (error) {
      this.logger.error(`Failed to initialize QR configuration consumer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle QR configuration event from RabbitMQ
   * This method processes the async QR configuration without affecting the main aggregation flow
   */
  private async handleQrConfigurationEvent(message: ConsumeMessage, channel: any): Promise<void> {
    const startTime = Date.now();
    let event: QrConfigurationEvent;

    try {
      // Parse the message content
      const content = message.content.toString();
      event = JSON.parse(content);
      
      this.logger.log(`Processing QR configuration event ${event.eventId} for QR: ${event.qrCodeValue}`);

      const result = await this.processQrConfiguration(event);
      
      // Publish result event (for monitoring/notification purposes)
      await this.publishConfigurationResult(result);
      
      // Acknowledge message only after successful processing
      channel.ack(message);
      
      this.logger.log(
        `Successfully processed QR configuration event ${event.eventId} in ${Date.now() - startTime}ms`
      );

    } catch (error) {
      const processingDuration = Date.now() - startTime;
      
      this.logger.error(
        `Failed to process QR configuration event ${event?.eventId || 'unknown'}: ${error.message}`,
        error.stack
      );

      // Publish failure result
      if (event) {
        const failureResult: QrConfigurationResult = {
          eventId: event.eventId,
          qrCodeValue: event.qrCodeValue,
          success: false,
          errorMessage: error.message,
          processedAt: new Date(),
          processingDuration,
        };
        await this.publishConfigurationResult(failureResult);
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
   * Process the QR configuration using the existing ConfigurationService
   */
  private async processQrConfiguration(event: QrConfigurationEvent): Promise<QrConfigurationResult> {
    const startTime = Date.now();

    try {
      // Validate that the QR still exists and is not configured
      const qrDoc = await this.qrCodeModel.findOne({ value: event.qrCodeValue }).exec();
      
      if (!qrDoc) {
        throw new Error(`QR code ${event.qrCodeValue} not found`);
      }

      if (qrDoc.configuredDate) {
        // QR is already configured, return success without doing anything
        return {
          eventId: event.eventId,
          qrCodeValue: event.qrCodeValue,
          success: true,
          configuredQr: qrDoc,
          processedAt: new Date(),
          processingDuration: Date.now() - startTime,
        };
      }

      // Create configuration DTO with required fields
      const configDto: CreateQrConfigrationDto = {
        qrCodeList: [event.qrCodeValue],
        productId: event.productId,
        hasAgg: false, // OUTER QRs typically don't have aggregation initially
        operationBatch: `auto-config-${event.eventId}`, // Generate operation batch
        workerName: event.author || 'system-auto-config', // Use author or default
        productionsDate: Date.now(), // Current timestamp
        orderNum: event.eventId, // Use event ID as order number
      };

      // Use existing configuration service to configure the QR
      const configuredQr = await this.configurationService.configureOuterQr(configDto);

      return {
        eventId: event.eventId,
        qrCodeValue: event.qrCodeValue,
        success: true,
        configuredQr,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        eventId: event.eventId,
        qrCodeValue: event.qrCodeValue,
        success: false,
        errorMessage: error.message,
        processedAt: new Date(),
        processingDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Publish configuration result to RabbitMQ
   */
  private async publishConfigurationResult(result: QrConfigurationResult): Promise<void> {
    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      await channel.publish(
        EXCHANGE_NAMES.QR_CONFIGURATION,
        ROUTING_KEYS.QR_CONFIGURE_RESULT,
        result,
        {
          persistent: true,
          messageId: `result-${result.eventId}`,
          timestamp: Date.now(),
          contentType: 'application/json',
        }
      );

      this.logger.debug(`Published QR configuration result for event ${result.eventId}`);
      
    } catch (error) {
      this.logger.error(`Failed to publish configuration result: ${error.message}`, error.stack);
    }
  }

  /**
   * Get retry count from message headers
   */
  private getRetryCount(message: ConsumeMessage): number {
    const headers = message.properties.headers || {};
    return headers['x-retry-count'] || 0;
  }

  /**
   * Public method to manually trigger configuration processing (for testing)
   */
  async processConfigurationEventManually(event: QrConfigurationEvent): Promise<QrConfigurationResult> {
    return this.processQrConfiguration(event);
  }
}