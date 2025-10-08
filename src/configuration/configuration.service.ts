import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { QrCode, QrCodeDocument, QrCodeTypeGenerator, ProductData } from '../models/qr-code.entity';
import { Product, ProductDocument } from '../models/product.entity';
import { CreateQrConfigrationDto } from './dto/create-qr-configration.dto';
import { ConfigurationHelpers } from './configuration.helpers';

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    @InjectModel(QrCode.name) private qrCodeModel: Model<QrCodeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  /**
   * Configure an OUTER QR code with validation, configuration, and relationship updates
   */
  async configureOuterQr(input: CreateQrConfigrationDto): Promise<QrCodeDocument> {
    const session = await this.connection.startSession();
    
    try {
      session.startTransaction();

      // Phase 1: Validation
      await this.validateConfiguration(input);
      
      // Find the target QR (assuming it's in the qrCodeList)
      const targetQrValue = input.qrCodeList?.[0]; // Adjust this logic based on your DTO structure
      if (!targetQrValue) {
        throw new Error('No QR code provided for configuration');
      }

      const targetQr = await ConfigurationHelpers.ensureQrExists(this.qrCodeModel, targetQrValue);
      
      // Validate QR type and configuration state
      ConfigurationHelpers.ensureType(targetQr, QrCodeTypeGenerator.OUTER);
      ConfigurationHelpers.ensureUnconfigured(targetQr);

      // Find parent package if provided
      const parentPackage = await ConfigurationHelpers.findParentPackage(
        this.qrCodeModel, 
        input.qrCodeList || []
      );

      let palletQr: QrCodeDocument | null = null;
      
      if (parentPackage) {
        // Validate parent is configured
        ConfigurationHelpers.ensureParentConfigured(parentPackage);
        
        // Validate product consistency
        const parentProductIds = ConfigurationHelpers.extractParentProductIds(parentPackage);
        if (parentProductIds.length > 0) {
          ConfigurationHelpers.ensureProductConsistency(input.productId, parentProductIds);
        }
        
        // Find pallet in hierarchy
        palletQr = await ConfigurationHelpers.findPalletQr(this.qrCodeModel, parentPackage);
      }

      // Get product details
      const product = await this.productModel.findById(input.productId).session(session).exec();
      if (!product) {
        throw new Error(`Product with ID '${input.productId}' not found`);
      }

      // Phase 2: Configuration
      const configuredQr = await this.applyConfiguration(targetQr, input, parentPackage, product, session);

      // Phase 3: Relationship Updates
      await this.updateRelationships(configuredQr, parentPackage, palletQr, session);

      await session.commitTransaction();
      
      this.logger.log(`Successfully configured OUTER QR: ${configuredQr.value}`);
      
      // Return the updated document with populated fields
      return await this.qrCodeModel
        .findById(configuredQr._id)
        .populate('productData.productId')
        .exec();
        
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(`Failed to configure OUTER QR: ${error.message}`, error.stack);
      ConfigurationHelpers.handleValidationError(error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Validate the configuration request
   */
  private async validateConfiguration(input: CreateQrConfigrationDto): Promise<void> {
    // Validate product exists
    const product = await this.productModel.findById(input.productId).exec();
    if (!product) {
      throw new Error(`Product with ID '${input.productId}' not found`);
    }

    // Additional validations can be added here
    if (!input.qrCodeList || input.qrCodeList.length === 0) {
      throw new Error('At least one QR code must be provided');
    }
  }

  /**
   * Apply configuration changes to the QR code
   */
  private async applyConfiguration(
    targetQr: QrCodeDocument,
    input: CreateQrConfigrationDto,
    parentPackage: QrCodeDocument | null,
    product: ProductDocument,
    session: any,
  ): Promise<QrCodeDocument> {
    const updateData: Partial<QrCode> = {
      isConfigured: true,
      hasAgg: true,
      configuredDate: new Date(),
    };

    // Add product data with unit counter = 1
    const productData: ProductData = {
      productId: input.productId,
      counter: 1,
      outers: undefined,
      pallets: undefined,
      packages: undefined,
    };

    updateData.productData = [productData];

    // Inherit from parent if available
    if (parentPackage) {
      updateData.supplierDetails = parentPackage.supplierDetails;
      updateData.verticalDetails = parentPackage.verticalDetails;
      updateData.productTypeDetails = parentPackage.productTypeDetails;
      updateData.supplier = parentPackage.supplier;
      updateData.vertical = parentPackage.vertical;
      updateData.productType = parentPackage.productType;
    }

    // Set metadata from input
    if (input.operationBatch) {
      updateData.operationBatch = input.operationBatch;
    }
    
    if (input.workerName) {
      updateData.workerName = input.workerName;
    }
    
    if (input.productionsDate) {
      updateData.productionsDate = input.productionsDate;
    }
    
    if (input.orderNum) {
      updateData.orderNum = input.orderNum;
    }

    if (input.numberOfAgg) {
      updateData.numberOfAgg = input.numberOfAgg;
    }

    if (input.aggQrCode) {
      updateData.aggQrCode = input.aggQrCode;
    }

    // Update the target QR
    const updatedQr = await this.qrCodeModel
      .findByIdAndUpdate(
        targetQr._id,
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      )
      .exec();

    if (!updatedQr) {
      throw new Error(`Failed to update QR code ${targetQr.value}`);
    }

    return updatedQr;
  }

  /**
   * Update relationships between QR codes
   */
  private async updateRelationships(
    targetQr: QrCodeDocument,
    parentPackage: QrCodeDocument | null,
    palletQr: QrCodeDocument | null,
    session: any,
  ): Promise<void> {
    const relationshipUpdates: Partial<QrCode> = {
      parents: [],
      directParent: undefined,
    };

    // Set direct parent and build parents array
    if (parentPackage) {
      relationshipUpdates.directParent = parentPackage.value;
      relationshipUpdates.parents = [parentPackage.value];

      // Add pallet to parents if it exists
      if (palletQr) {
        relationshipUpdates.parents.push(palletQr.value);
      }

      // Update parent package aggregation counters
      await this.updateParentCounters(parentPackage, session);
      
      // Update pallet counters if exists
      if (palletQr) {
        await this.updateParentCounters(palletQr, session);
      }
    }

    // Apply relationship updates
    await this.qrCodeModel
      .findByIdAndUpdate(
        targetQr._id,
        { $set: relationshipUpdates },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      )
      .exec();
  }

  /**
   * Update aggregation counters on parent QR codes
   */
  private async updateParentCounters(
    parentQr: QrCodeDocument,
    session: any,
  ): Promise<void> {
    // Increment counters based on parent type
    const updates: any = {};

    // Find matching product data entry and increment counter
    if (parentQr.productData && parentQr.productData.length > 0) {
      const productDataUpdates = parentQr.productData.map(pd => ({
        ...pd,
        counter: (pd.counter || 0) + 1,
      }));
      updates.productData = productDataUpdates;
    }

    // Update numberOfAgg if it exists
    if (parentQr.numberOfAgg !== undefined) {
      updates.numberOfAgg = (parentQr.numberOfAgg || 0) + 1;
    }

    await this.qrCodeModel
      .findByIdAndUpdate(
        parentQr._id,
        { $set: updates },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      )
      .exec();
  }

  /**
   * Get configured QR by value or ID
   */
  async getConfiguredQr(qrValueOrId: string): Promise<QrCodeDocument> {
    const qr = await ConfigurationHelpers.ensureQrExists(this.qrCodeModel, qrValueOrId);
    
    return await this.qrCodeModel
      .findById(qr._id)
      .populate('productData.productId')
      .populate('supplier')
      .populate('vertical')
      .populate('productType')
      .exec();
  }
}