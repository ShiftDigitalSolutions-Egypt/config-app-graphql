import { SessionMode } from '../../common/enums';

/**
 * Interface for package update events
 */
export interface PackageUpdateEvent {
  eventId: string;
  channelId: string;
  messageIds: string[];
  sessionMode: SessionMode;
  packageQrCode: string;
  
  // Processing metadata
  timestamp: Date;
  author?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for real-time package cycle events (NEW WORKFLOW)
 * Triggered when a package QR is reached in FULL_PACKAGE_AGGREGATION
 * Database operations (outer messages retrieval) moved to consumer for async processing
 */
export interface PackageCycleEvent {
  eventId: string;
  channelId: string;
  packageQrCode: string;
  outersQrCodes?: string[];
  
  // Processing metadata
  timestamp: Date;
  author?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for package cycle result
 */
export interface PackageCycleResult {
  eventId: string;
  channelId: string;
  packageQrCode: string;
  success: boolean;
  processedOuterCount: number;
  processedAt: Date;
  processingDuration: number;
  errorMessage?: string;
  updatedPackageQr?: string;
  updatedOuterQrs?: string[];
}

/**
 * Interface for package update result
 */
export interface PackageUpdateResult {
  eventId: string;
  channelId: string;
  success: boolean;
  processedMessageCount: number;
  processedAt: Date;
  processingDuration: number;
  errorMessage?: string;
  updatedPackageQr?: string;
  updatedChildQrs?: string[];
}

/**
 * Interface for enrichment data
 */
export interface EnrichmentData {
  targetQrCode: string;
  firstOuterQrCode: string;
  productId: string;
  channelSessionMode: SessionMode;
}

/**
 * Exchange names for package update workflow
 */
export const PACKAGE_UPDATE_EXCHANGE_NAMES = {
  PACKAGE_UPDATE: 'package.update',
} as const;

/**
 * Queue names for package update workflow  
 */
export const PACKAGE_UPDATE_QUEUE_NAMES = {
  PACKAGE_UPDATE: 'package.update.queue',
  PACKAGE_UPDATE_RESULTS: 'package.update.results.queue',
} as const;

/**
 * Routing keys for package update workflow
 */
export const PACKAGE_UPDATE_ROUTING_KEYS = {
  PACKAGE_UPDATE_REQUEST: 'package.update.request',
  PACKAGE_UPDATE_RESULT: 'package.update.result',
  PACKAGE_CYCLE_REQUEST: 'package.cycle.request',
  PACKAGE_CYCLE_RESULT: 'package.cycle.result',
} as const;