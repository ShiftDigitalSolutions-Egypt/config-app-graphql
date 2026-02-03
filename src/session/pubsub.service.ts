import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { SessionGQL, SessionEvent, SessionMessageGQL, MessageEvent, PackageAggregationEvent } from './session.types';
import { SessionEventKind, MessageEventKind } from '../common/enums';

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private pubsub = new PubSub();
  private changeStreams: any[] = [];

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async publishSessionEvent(session: SessionGQL, kind: SessionEventKind) {
    const event: SessionEvent = {
      kind,
      session: session,
    };

    await this.pubsub.publish(`SESSION_EVENTS_${session.id}`, {
      sessionEvents: event,
    });

    // Also publish to a global session events stream
    await this.pubsub.publish('SESSION_EVENTS', {
      sessionEvents: event,
    });
  }

  async publishMessageEvent(message: SessionMessageGQL, kind: MessageEventKind) {
    const event: MessageEvent = {
      kind,
      message,
    };

    await this.pubsub.publish(`MESSAGE_EVENTS_${message.sessionId}`, {
      messageEvents: event,
    });

    // Also publish to a global message events stream
    await this.pubsub.publish('MESSAGE_EVENTS', {
      messageEvents: event,
    });
  }

  getAsyncIterator(sessionId: string) {
    return this.pubsub.asyncIterator(`SESSION_EVENTS_${sessionId}`);
  }

  getSessionAsyncIterator() {
    return this.pubsub.asyncIterator('SESSION_EVENTS');
  }

  getMessageAsyncIterator(sessionId?: string) {
    if (sessionId) {
      return this.pubsub.asyncIterator(`MESSAGE_EVENTS_${sessionId}`);
    }
    return this.pubsub.asyncIterator('MESSAGE_EVENTS');
  }

  async publishPackageAggregationEvent(event: PackageAggregationEvent) {
    await this.pubsub.publish(`PACKAGE_AGGREGATION_${event.sessionId}`, {
      packageAggregationEvents: event,
    });

    // Also publish to a global package aggregation stream
    await this.pubsub.publish('PACKAGE_AGGREGATION_EVENTS', {
      packageAggregationEvents: event,
    });
  }

  getPackageAggregationAsyncIterator(sessionId?: string) {
    if (sessionId) {
      return this.pubsub.asyncIterator(`PACKAGE_AGGREGATION_${sessionId}`);
    }
    return this.pubsub.asyncIterator('PACKAGE_AGGREGATION_EVENTS');
  }

  /**
   * Close all subscriptions related to a specific session
   */
  async closeSessionSubscriptions(sessionId: string) {
    this.logger.log(`Closing subscriptions for session ${sessionId}`);
    
    try {
      // Publish final closure events to notify all subscribers
      await this.pubsub.publish(`SESSION_EVENTS_${sessionId}`, {
        sessionEvents: {
          kind: 'SUBSCRIPTION_CLOSED',
          session: { id: sessionId },
        },
      });

      await this.pubsub.publish(`MESSAGE_EVENTS_${sessionId}`, {
        messageEvents: {
          kind: 'SUBSCRIPTION_CLOSED',
          message: { sessionId: sessionId },
        },
      });

      await this.pubsub.publish(`PACKAGE_AGGREGATION_${sessionId}`, {
        packageAggregationEvents: {
          sessionId: sessionId,
          eventType: 'SESSION_CLOSED',
          messageId: '',
          data: null,
          error: null,
        },
      });

      this.logger.log(`Successfully closed subscriptions for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to close subscriptions for session ${sessionId}:`, error);
      throw error;
    }
  }

  async onModuleInit() {
    this.logger.log('Initializing MongoDB Change Streams for real-time updates');
    this.setupSessionChangeStream();
    this.setupSessionMessageChangeStream();
  }

  async onModuleDestroy() {
    this.logger.log('Closing MongoDB Change Streams');
    for (const stream of this.changeStreams) {
      await stream.close();
    }
    this.changeStreams = [];
  }

  private setupSessionChangeStream() {
    try {
      const sessionCollection = this.connection.collection('agg-sessions');
      const sessionChangeStream = sessionCollection.watch([
        {
          $match: {
            'operationType': { $in: ['insert', 'update', 'delete'] }
          }
        }
      ]);

      sessionChangeStream.on('change', (change: any) => {
        this.logger.debug(`Session change detected: ${change.operationType}`);
        this.handleSessionChange(change);
      });

      sessionChangeStream.on('error', (error: any) => {
        this.logger.error('Session change stream error:', error);
      });

      this.changeStreams.push(sessionChangeStream);
    } catch (error) {
      this.logger.error('Failed to setup session change stream:', error);
    }
  }

  private setupSessionMessageChangeStream() {
    try {
      const messageCollection = this.connection.collection('sessionmessages');
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

  private async handleSessionChange(change: any) {
    let eventKind: SessionEventKind;
    let session: any;

    switch (change.operationType) {
      case 'insert':
        eventKind = SessionEventKind.CREATED;
        session = change.fullDocument;
        break;
      case 'update':
        eventKind = SessionEventKind.UPDATED;
        // For updates, we need to fetch the full document
        const sessionCollection = this.connection.collection('agg-sessions');
        session = await sessionCollection.findOne({ _id: change.documentKey._id });
        break;
      case 'delete':
        eventKind = SessionEventKind.DELETED;
        session = change.fullDocumentBeforeChange || { _id: change.documentKey._id };
        break;
      default:
        return;
    }

    if (session) {
      const sessionGQL: SessionGQL = {
        id: session._id.toString(),
        _id: session._id.toString(),
        name: session.name || '',
        description: session.description || '',
        status: session.status,
        sessionMode: session.sessionMode,
        userId: session.userId,
        processedQrCodes: session.processedQrCodes || [],
        channelId: session.channelId || null,
        createdAt: session.createdAt || new Date(),
        updatedAt: session.updatedAt || new Date(),
      };

      await this.publishSessionEvent(sessionGQL, eventKind);
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
        const messageCollection = this.connection.collection('sessionmessages');
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
      const messageGQL: SessionMessageGQL = {
        id: message._id.toString(),
        _id: message._id.toString(),
        content: message.content || '',
        author: message.author || '',
        sessionId: message.sessionId?.toString() || '',
        status: message.status,
        aggregationData: message.aggregationData,
        errorMessage: message.errorMessage,
        createdAt: message.createdAt || new Date(),
        updatedAt: message.updatedAt || new Date(),
      };

      await this.publishMessageEvent(messageGQL, eventKind);

      // If this is an aggregation message, also publish aggregation-specific events
      if (message.aggregationData) {
        // Serialize aggregationData to JSON string for GraphQL compatibility
        let serializedData: string | undefined;
        try {
          serializedData = JSON.stringify(message.aggregationData);
        } catch (serializationError) {
          console.warn(
            `Failed to serialize aggregation data: ${serializationError.message}. Using string representation.`
          );
          serializedData = String(message.aggregationData);
        }

        const aggregationEvent: PackageAggregationEvent = {
          sessionId: message.sessionId?.toString() || '',
          messageId: message._id.toString(),
          eventType: this.getAggregationEventType(message.status, eventKind),
          data: serializedData,
          error: message.errorMessage,
          status: message.status,
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