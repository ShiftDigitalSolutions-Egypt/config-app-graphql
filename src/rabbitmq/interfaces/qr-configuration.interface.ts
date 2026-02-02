export interface QrConfigurationEvent {
  /** Unique event ID for tracking */
  eventId: string;
  
  /** QR code value to be configured */
  qrCodeValue: string;
  
  /** Product ID for configuration */
  productId: string;
  
  /** Session ID that triggered the configuration request */
  sessionId: string;
  
  /** Session mode that requested the configuration */
  sessionMode: string;
  
  /** Author/operator who initiated the request */
  author: string;
  
  /** Timestamp when the event was created */
  timestamp: Date;
  
  /** Optional metadata */
  metadata?: {
    /** QR type (OUTER, PACKAGE, etc.) */
    qrType?: string;
    /** Retry count for failed attempts */
    retryCount?: number;
    /** Original error that triggered this configuration request */
    originalError?: string;
    /** Additional context data */
    context?: Record<string, any>;
  };
}

export interface QrConfigurationResult {
  /** Event ID that was processed */
  eventId: string;
  
  /** QR code value that was configured */
  qrCodeValue: string;
  
  /** Whether configuration was successful */
  success: boolean;
  
  /** Error message if configuration failed */
  errorMessage?: string;
  
  /** Configured QR document data (if successful) */
  configuredQr?: any;
  
  /** Processing timestamp */
  processedAt: Date;
  
  /** Duration of configuration process in milliseconds */
  processingDuration: number;
}

export const QUEUE_NAMES = {
  QR_CONFIGURATION: 'qr-configuration-queue',
  QR_CONFIGURATION_RESULTS: 'qr-configuration-results-queue',
} as const;

export const EXCHANGE_NAMES = {
  QR_CONFIGURATION: 'qr-configuration-exchange',
} as const;

export const ROUTING_KEYS = {
  QR_CONFIGURE: 'qr.configure',
  QR_CONFIGURE_RESULT: 'qr.configure.result',
} as const;