import { ObjectId, Types } from 'mongoose';
import { SessionEventKind, MessageEventKind, SessionStatus, SessionMode, MessageStatus } from '../common/enums';

export interface SessionGQL {
  id: string;
  _id: string;
  name: string;
  description?: string;
  status: SessionStatus;
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

export interface SessionMessageGQL {
  id: string;
  _id: string;
  content: string;
  author: string;
  sessionId: string;
  session?: SessionGQL;
  status: MessageStatus;
  aggregationData?: AggregationDataGQL;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionEvent {
  kind: SessionEventKind;
  session: SessionGQL;
}

export interface MessageEvent {
  kind: MessageEventKind;
  message: SessionMessageGQL;
}

export interface PackageAggregationEvent {
  sessionId: string;
  messageId: string;
  eventType: 'VALIDATION_COMPLETED' | 'CONFIGURATION_COMPLETED' | 'ERROR' | 'SESSION_CLOSED' | 'PACKAGE_COMPLETION' | 'PALLET_COMPLETION';
  data?: string; // Serialized JSON string for GraphQL compatibility
  error?: string;
  status?: MessageStatus;
}