import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { ChannelGQL, ChannelEvent, ChannelMessageGQL, MessageEvent, PackageAggregationEvent } from './channel.types';
import { ChannelEventKind, MessageEventKind } from '../common/enums';

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private pubsub = new PubSub();
  private changeStreams: any[] = [];

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async publishChannelEvent(channel: ChannelGQL, kind: ChannelEventKind) {
    const event: ChannelEvent = {
      kind,
      channel,
    };

    await this.pubsub.publish(`CHANNEL_EVENTS_${channel.id}`, {
      channelEvents: event,
    });

    // Also publish to a global channel events stream
    await this.pubsub.publish('CHANNEL_EVENTS', {
      channelEvents: event,
    });
  }

  async publishMessageEvent(message: ChannelMessageGQL, kind: MessageEventKind) {
    const event: MessageEvent = {
      kind,
      message,
    };

    await this.pubsub.publish(`MESSAGE_EVENTS_${message.channelId}`, {
      messageEvents: event,
    });

    // Also publish to a global message events stream
    await this.pubsub.publish('MESSAGE_EVENTS', {
      messageEvents: event,
    });
  }

  getAsyncIterator(channelId: string) {
    return this.pubsub.asyncIterator(`CHANNEL_EVENTS_${channelId}`);
  }

  getChannelAsyncIterator() {
    return this.pubsub.asyncIterator('CHANNEL_EVENTS');
  }

  getMessageAsyncIterator(channelId?: string) {
    if (channelId) {
      return this.pubsub.asyncIterator(`MESSAGE_EVENTS_${channelId}`);
    }
    return this.pubsub.asyncIterator('MESSAGE_EVENTS');
  }

  async publishPackageAggregationEvent(event: PackageAggregationEvent) {
    await this.pubsub.publish(`PACKAGE_AGGREGATION_${event.channelId}`, {
      packageAggregationEvents: event,
    });

    // Also publish to a global package aggregation stream
    await this.pubsub.publish('PACKAGE_AGGREGATION_EVENTS', {
      packageAggregationEvents: event,
    });
  }

  getPackageAggregationAsyncIterator(channelId?: string) {
    if (channelId) {
      return this.pubsub.asyncIterator(`PACKAGE_AGGREGATION_${channelId}`);
    }
    return this.pubsub.asyncIterator('PACKAGE_AGGREGATION_EVENTS');
  }

  /**
   * Close all subscriptions related to a specific channel
   */
  async closeChannelSubscriptions(channelId: string) {
    this.logger.log(`Closing subscriptions for channel ${channelId}`);
    
    try {
      // Publish final closure events to notify all subscribers
      await this.pubsub.publish(`CHANNEL_EVENTS_${channelId}`, {
        channelEvents: {
          kind: 'SUBSCRIPTION_CLOSED',
          channel: { id: channelId },
        },
      });

      await this.pubsub.publish(`MESSAGE_EVENTS_${channelId}`, {
        messageEvents: {
          kind: 'SUBSCRIPTION_CLOSED',
          message: { channelId },
        },
      });

      await this.pubsub.publish(`PACKAGE_AGGREGATION_${channelId}`, {
        packageAggregationEvents: {
          channelId,
          eventType: 'SESSION_CLOSED',
          messageId: '',
          data: null,
          error: null,
        },
      });

      this.logger.log(`Successfully closed subscriptions for channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Failed to close subscriptions for channel ${channelId}:`, error);
      throw error;
    }
  }

  async onModuleInit() {
    this.logger.log('Initializing MongoDB Change Streams for real-time updates');
    this.setupChannelChangeStream();
    this.setupChannelMessageChangeStream();
  }

  async onModuleDestroy() {
    this.logger.log('Closing MongoDB Change Streams');
    for (const stream of this.changeStreams) {
      await stream.close();
    }
    this.changeStreams = [];
  }

  private setupChannelChangeStream() {
    try {
      const channelCollection = this.connection.collection('channels');
      const channelChangeStream = channelCollection.watch([
        {
          $match: {
            'operationType': { $in: ['insert', 'update', 'delete'] }
          }
        }
      ]);

      channelChangeStream.on('change', (change: any) => {
        this.logger.debug(`Channel change detected: ${change.operationType}`);
        this.handleChannelChange(change);
      });

      channelChangeStream.on('error', (error: any) => {
        this.logger.error('Channel change stream error:', error);
      });

      this.changeStreams.push(channelChangeStream);
    } catch (error) {
      this.logger.error('Failed to setup channel change stream:', error);
    }
  }

  private setupChannelMessageChangeStream() {
    try {
      const messageCollection = this.connection.collection('channelmessages');
      const messageChangeStream = messageCollection.watch([
        {
          $match: {
            'operationType': { $in: ['insert', 'update', 'delete'] }
          }
        }
      ]);

      messageChangeStream.on('change', (change: any) => {
        this.logger.debug(`Message change detected: ${change.operationType}`);
        this.handleMessageChange(change);
      });

      messageChangeStream.on('error', (error: any) => {
        this.logger.error('Message change stream error:', error);
      });

      this.changeStreams.push(messageChangeStream);
    } catch (error) {
      this.logger.error('Failed to setup message change stream:', error);
    }
  }

  private async handleChannelChange(change: any) {
    let eventKind: ChannelEventKind;
    let channel: any;

    switch (change.operationType) {
      case 'insert':
        eventKind = ChannelEventKind.CREATED;
        channel = change.fullDocument;
        break;
      case 'update':
        eventKind = ChannelEventKind.UPDATED;
        // For updates, we need to fetch the full document
        const channelCollection = this.connection.collection('channels');
        channel = await channelCollection.findOne({ _id: change.documentKey._id });
        break;
      case 'delete':
        eventKind = ChannelEventKind.DELETED;
        channel = change.fullDocumentBeforeChange || { _id: change.documentKey._id };
        break;
      default:
        return;
    }

    if (channel) {
      const channelGQL: ChannelGQL = {
        id: channel._id.toString(),
        _id: channel._id.toString(),
        name: channel.name || '',
        description: channel.description || '',
        status: channel.status,
        sessionMode: channel.sessionMode,
        userId: channel.userId,
        processedQrCodes: channel.processedQrCodes || [],
        createdAt: channel.createdAt || new Date(),
        updatedAt: channel.updatedAt || new Date(),
      };

      await this.publishChannelEvent(channelGQL, eventKind);
    }
  }

  private async handleMessageChange(change: any) {
    let eventKind: MessageEventKind;
    let message: any;

    switch (change.operationType) {
      case 'insert':
        eventKind = MessageEventKind.CREATED;
        message = change.fullDocument;
        break;
      case 'update':
        eventKind = MessageEventKind.UPDATED;
        // For updates, we need to fetch the full document
        const messageCollection = this.connection.collection('channelmessages');
        message = await messageCollection.findOne({ _id: change.documentKey._id });
        break;
      case 'delete':
        eventKind = MessageEventKind.DELETED;
        message = change.fullDocumentBeforeChange || { _id: change.documentKey._id };
        break;
      default:
        return;
    }

    if (message) {
      const messageGQL: ChannelMessageGQL = {
        id: message._id.toString(),
        _id: message._id.toString(),
        content: message.content || '',
        author: message.author || '',
        channelId: message.channelId?.toString() || '',
        status: message.status,
        aggregationData: message.aggregationData,
        errorMessage: message.errorMessage,
        createdAt: message.createdAt || new Date(),
        updatedAt: message.updatedAt || new Date(),
      };

      await this.publishMessageEvent(messageGQL, eventKind);

      // If this is an aggregation message, also publish aggregation-specific events
      if (message.aggregationData) {
        const aggregationEvent: PackageAggregationEvent = {
          channelId: message.channelId?.toString() || '',
          messageId: message._id.toString(),
          eventType: this.getAggregationEventType(message.status, eventKind),
          data: message.aggregationData,
          error: message.errorMessage,
        };

        await this.publishPackageAggregationEvent(aggregationEvent);
      }
    }
  }

  private getAggregationEventType(messageStatus: string, eventKind: MessageEventKind): PackageAggregationEvent['eventType'] {
    if (eventKind === MessageEventKind.CREATED && messageStatus === 'PROCESSING') {
      return 'VALIDATION_COMPLETED';
    }
    if (eventKind === MessageEventKind.UPDATED && messageStatus === 'VALID') {
      return 'CONFIGURATION_COMPLETED';
    }
    if (messageStatus === 'ERROR') {
      return 'ERROR';
    }
    return 'VALIDATION_COMPLETED';
  }

  async close() {
    await this.onModuleDestroy();
  }
}