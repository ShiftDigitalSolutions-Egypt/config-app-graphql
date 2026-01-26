import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQConnectionService } from '../services/rabbitmq-connection.service';
import {
  PackageUpdateEvent,
  PackageCycleEvent,
  PACKAGE_UPDATE_EXCHANGE_NAMES,
  PACKAGE_UPDATE_ROUTING_KEYS,
} from '../interfaces/package-update.interface';
import { SessionMode } from '../../common/enums';
import { CreateQrConfigrationDto } from '@/configuration/dto/create-qr-configration.dto';

@Injectable()
export class PackageUpdatePublisher {
  private readonly logger = new Logger(PackageUpdatePublisher.name);

  constructor(
    private readonly rabbitMQConnection: RabbitMQConnectionService
  ) {}

  /**
   * Publish package update event for processing validated messages
   * This replaces the direct processing in finalizePackageAggregation
   */
  async publishPackageUpdateEvent(
    channelId: string,
    messageIds: string[],
    sessionMode: SessionMode,
    packageQrCode: string,
    author?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const eventId = uuidv4();
    
    const event: PackageUpdateEvent = {
      eventId,
      channelId,
      messageIds,
      sessionMode,
      packageQrCode,
      timestamp: new Date(),
      author,
      metadata,
    };

    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      await channel.publish(
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_REQUEST,
        event,
        {
          persistent: true,
          messageId: eventId,
          timestamp: Date.now(),
          contentType: 'application/json',
          correlationId: channelId,
        }
      );

      this.logger.log(
        `Published package update event ${eventId} for channel ${channelId} with ${messageIds.length} messages`
      );

      return eventId;

    } catch (error) {
      this.logger.error(
        `Failed to publish package update event for channel ${channelId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Publish real-time package cycle event when a package is reached in FULL_PACKAGE_AGGREGATION
   * This enables immediate processing trigger - database operations moved to consumer for async processing
   */
  async publishPackageCycleEvent(
    channelId: string,
    packageQrCode: string,
      outersQrCodes?: string[],
      createQrConfigrationDto?: CreateQrConfigrationDto,
    author?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const eventId = uuidv4();
    
    const event: PackageCycleEvent = {
      eventId,
      channelId,
      packageQrCode,
      outersQrCodes: outersQrCodes,
      timestamp: new Date(),
      author,
      metadata,
    };

    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      await channel.publish(
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_REQUEST,
        event,
        {
          persistent: true,
          messageId: eventId,
          timestamp: Date.now(),
          contentType: 'application/json',
          correlationId: channelId,
          headers: {
            'x-package-cycle': true,
            'x-package-qr': packageQrCode,
          },
        }
      );

      this.logger.log(
        `Published package cycle event ${eventId} for channel ${channelId}, package: ${packageQrCode}`
      );

      return eventId;

    } catch (error) {
      this.logger.error(
        `Failed to publish package cycle event for channel ${channelId}, package ${packageQrCode}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Publish batch package update events for multiple channels
   */
  async publishBatchPackageUpdateEvents(
    events: Array<{
      channelId: string;
      messageIds: string[];
      sessionMode: SessionMode;
      targetQrCode: string;
      author?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<string[]> {
    const eventIds: string[] = [];

    try {
      const channel = this.rabbitMQConnection.getPublisherChannel();
      
      // Publish all events in parallel
      const publishPromises = events.map(async (eventData) => {
        const eventId = uuidv4();
        
        const event: PackageUpdateEvent = {
          eventId,
          channelId: eventData.channelId,
          messageIds: eventData.messageIds,
          sessionMode: eventData.sessionMode,
          packageQrCode: eventData.targetQrCode,
          timestamp: new Date(),
          author: eventData.author,
          metadata: eventData.metadata,
        };

        await channel.publish(
          PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
          PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_REQUEST,
          event,
          {
            persistent: true,
            messageId: eventId,
            timestamp: Date.now(),
            contentType: 'application/json',
            correlationId: eventData.channelId,
          }
        );

        eventIds.push(eventId);
        
        this.logger.debug(
          `Published package update event ${eventId} for channel ${eventData.channelId}`
        );

        return eventId;
      });

      await Promise.all(publishPromises);

      this.logger.log(
        `Successfully published ${eventIds.length} package update events in batch`
      );

      return eventIds;

    } catch (error) {
      this.logger.error(
        `Failed to publish batch package update events: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  
}