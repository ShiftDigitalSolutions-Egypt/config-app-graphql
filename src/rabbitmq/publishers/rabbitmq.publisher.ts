import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQConnectionService } from '../services/rabbitmq-connection.service';
import {
  QrConfigurationEvent,
  EXCHANGE_NAMES,
  ROUTING_KEYS,
} from '../interfaces/qr-configuration.interface';

@Injectable()
export class RabbitMQPublisher implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(private readonly rabbitMQConnection: RabbitMQConnectionService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.rabbitMQConnection.initialize();
      this.logger.log('RabbitMQ Publisher initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ Publisher: ${error.message}`, error.stack);
      // Don't throw to allow application to start even if RabbitMQ is down
    }
  }

  /**
   * Publish QR configuration event to RabbitMQ
   * This is a fire-and-forget operation that doesn't block the main flow
   */
  async publishQrConfigurationEvent(
    qrCodeValue: string,
    productId: string,
    channelId: string,
    sessionMode: string,
    author: string,
    metadata?: QrConfigurationEvent['metadata']
  ): Promise<void> {
    const eventId = uuidv4();
    
    const event: QrConfigurationEvent = {
      eventId,
      qrCodeValue,
      productId,
      channelId,
      sessionMode,
      author,
      timestamp: new Date(),
      metadata,
    };

    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      // Publish to RabbitMQ exchange
      await channel.publish(
        EXCHANGE_NAMES.QR_CONFIGURATION,
        ROUTING_KEYS.QR_CONFIGURE,
        event,
        {
          persistent: true, // Make sure message survives broker restart
          messageId: eventId,
          timestamp: Date.now(),
          contentType: 'application/json',
        }
      );

      this.logger.log(`Published QR configuration event ${eventId} for QR: ${qrCodeValue}`);
      
    } catch (error) {
      // Fire-and-forget: log error but don't throw to avoid interrupting main flow
      this.logger.error(
        `Failed to publish QR configuration event for QR ${qrCodeValue}: ${error.message}`,
        error.stack
      );
      
      // Fallback: log the event details for manual processing if needed
      this.logger.warn(`QR Configuration Event (FAILED): ${JSON.stringify(event, null, 2)}`);
    }
  }

  /**
   * Publish multiple QR configuration events in batch
   */
  async publishQrConfigurationEventsBatch(
    events: Array<Omit<QrConfigurationEvent, 'eventId' | 'timestamp'>>
  ): Promise<void> {
    const publishPromises = events.map((eventData) =>
      this.publishQrConfigurationEvent(
        eventData.qrCodeValue,
        eventData.productId,
        eventData.channelId,
        eventData.sessionMode,
        eventData.author,
        eventData.metadata
      )
    );

    // Fire-and-forget: don't await, just initiate all publishes
    Promise.allSettled(publishPromises).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected').length;
      const successful = results.length - failed;
      
      if (failed > 0) {
        this.logger.warn(`Batch publish completed: ${successful} successful, ${failed} failed out of ${events.length} events`);
      } else {
        this.logger.debug(`Successfully published ${events.length} QR configuration events in batch`);
      }
    });
  }
}