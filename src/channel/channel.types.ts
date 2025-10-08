import { ChannelEventKind, MessageEventKind } from '../common/enums';

export interface ChannelGQL {
  id: string;
  _id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelMessageGQL {
  id: string;
  _id: string;
  content: string;
  author: string;
  channelId: string;
  channel?: ChannelGQL;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelEvent {
  kind: ChannelEventKind;
  channel: ChannelGQL;
}

export interface MessageEvent {
  kind: MessageEventKind;
  message: ChannelMessageGQL;
}