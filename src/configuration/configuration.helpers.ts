import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QrCode, QrCodeDocument, QrCodeTypeGenerator } from '../models/qr-code.entity';
import { Model } from 'mongoose';

export class ConfigurationValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'ConfigurationValidationError';
  }
}

export class ConfigurationHelpers {
  /**
   * Ensure QR exists in database
   */
  static async ensureQrExists(
    qrModel: Model<QrCodeDocument>,
    qrValueOrId: string,
  ): Promise<QrCodeDocument> {
    const qr = await qrModel.findOne({
      value: qrValueOrId
    }).exec();

    if (!qr) {
      throw new ConfigurationValidationError(
        'NOT_FOUND',
        `QR code with value or ID '${qrValueOrId}' not found`,
        { qrValueOrId },
      );
    }

    return qr;
  }

  /**
   * Ensure QR is unconfigured
   */
  static ensureUnconfigured(qrDoc: QrCodeDocument): void {
    const isConfigured = 
      qrDoc.isConfigured ||
      (qrDoc.productData && qrDoc.productData.length > 0) ||
      (qrDoc.parents && qrDoc.parents.length > 0);

    if (isConfigured) {
      throw new ConfigurationValidationError(
        'ALREADY_CONFIGURED',
        `QR code '${qrDoc.value}' is already configured`,
        { 
          qrValue: qrDoc.value,
          isConfigured: qrDoc.isConfigured,
          hasProductData: qrDoc.productData?.length > 0,
          hasParents: qrDoc.parents?.length > 0,
        },
      );
    }
  }

  /**
   * Ensure QR type matches expected type
   */
  static ensureType(qrDoc: QrCodeDocument, expectedType: QrCodeTypeGenerator): void {
    if (qrDoc.type !== expectedType) {
      throw new ConfigurationValidationError(
        'INVALID_QR_TYPE',
        `QR code type '${qrDoc.type}' does not match expected type '${expectedType}'`,
        { 
          qrValue: qrDoc.value,
          actualType: qrDoc.type,
          expectedType,
        },
      );
    }
  }

  /**
   * Ensure parent QR is configured
   */
  static ensureParentConfigured(parentQrDoc: QrCodeDocument): void {
    if (!parentQrDoc.isConfigured) {
      throw new ConfigurationValidationError(
        'PARENT_NOT_CONFIGURED',
        `Parent QR code '${parentQrDoc.value}' is not configured`,
        { 
          parentQrValue: parentQrDoc.value,
          parentIsConfigured: parentQrDoc.isConfigured,
        },
      );
    }
  }

  /**
   * Ensure product consistency between child and parent
   */
  static ensureProductConsistency(
    childProductId: string,
    parentProductId: string | string[],
  ): void {
    const parentProductIds = Array.isArray(parentProductId) ? parentProductId : [parentProductId];
    
    if (!parentProductIds.includes(childProductId)) {
      throw new ConfigurationValidationError(
        'PRODUCT_MISMATCH',
        `Child product ID '${childProductId}' does not match any parent product IDs`,
        { 
          childProductId,
          parentProductIds,
        },
      );
    }
  }


  /**
   * Find pallet QR from parents hierarchy
   */
  static async findPalletQr(
    qrModel: Model<QrCodeDocument>,
    parentPackage: QrCodeDocument,
  ): Promise<QrCodeDocument | null> {
    if (!parentPackage.parents || parentPackage.parents.length === 0) {
      return null;
    }

    // Look for pallet in parent's parents
    for (const parentValue of parentPackage.parents) {
      try {
        const qr = await this.ensureQrExists(qrModel, parentValue);
        // Assuming pallets can be identified by some property
        // This logic may need to be adjusted based on your actual QR hierarchy
        if (qr.type === QrCodeTypeGenerator.QUANTIFIED || qr.hasPallet) {
          return qr; // This is likely a pallet
        }
      } catch (error) {
        // Continue searching if this QR is not found
        continue;
      }
    }

    return null;
  }

  /**
   * Extract product IDs from parent's product data
   */
  static extractParentProductIds(parentQr: QrCodeDocument): string[] {
    if (!parentQr.productData || parentQr.productData.length === 0) {
      return [];
    }

    return parentQr.productData
      .map(pd => pd.productId)
      .filter(id => !!id);
  }

  /**
   * Convert validation error to appropriate GraphQL error
   */
  static handleValidationError(error: any): never {
    if (error instanceof ConfigurationValidationError) {
      switch (error.code) {
        case 'NOT_FOUND':
          throw new NotFoundException(error.message);
        case 'ALREADY_CONFIGURED':
        case 'INVALID_QR_TYPE':
        case 'PARENT_NOT_CONFIGURED':
        case 'PRODUCT_MISMATCH':
          throw new BadRequestException({
            code: error.code,
            message: error.message,
            details: error.details,
          });
        default:
          throw new BadRequestException(error.message);
      }
    }
    
    // Re-throw unexpected errors
    throw error;
  }
}