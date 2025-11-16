import { ChannelEventKind, MessageEventKind, ChannelStatus, SessionMode, MessageStatus } from '../common/enums';

export interface ChannelGQL {
  id: string;
  _id: string;
  name: string;
  description?: string;
  status: ChannelStatus;
  sessionMode?: SessionMode;
  userId?: string;
  processedQrCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregationDataGQL {
  targetQr?: string;
  childQrCode?: string;
  productId?: string;
  eventType?: string;
  metadata?: string;
}

export interface ChannelMessageGQL {
  id: string;
  _id: string;
  content: string;
  author: string;
  channelId: string;
  channel?: ChannelGQL;
  status: MessageStatus;
  aggregationData?: AggregationDataGQL;
  errorMessage?: string;
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

export interface PackageAggregationEvent {
  channelId: string;
  messageId: string;
  eventType: 'VALIDATION_COMPLETED' | 'CONFIGURATION_COMPLETED' | 'ERROR' | 'SESSION_CLOSED';
  data?: string; // Serialized JSON string for GraphQL compatibility
  error?: string;
  status?: MessageStatus;
}