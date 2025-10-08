import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ChannelGQL, ChannelEvent, ChannelMessageGQL, MessageEvent } from './channel.types';
import { ChannelEventKind, MessageEventKind } from '../common/enums';

@Injectable()
export class PubSubService {
  private pubsub = new PubSub();

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

  async close() {
    // No explicit close method in PubSub, implement cleanup if necessary
    // Can be extended in the future for cleanup logic
  }
}