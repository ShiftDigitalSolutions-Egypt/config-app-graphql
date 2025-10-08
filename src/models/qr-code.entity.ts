import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import mongoose, { Document, Schema as MongooseSchema } from 'mongoose';
import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { PropertyValue } from './property-value.entity';
import { Property } from './property.entity';
import { WarehouseDetails } from './qr-code-log.entity';
import { ScanAction } from './scan.entity';
import {
  ExtendedProduct,
  ExtendedProductType,
  ExtendedSupplier,
  ExtendedVertical,
  UserScanInterFace,
  UserTypeData,
} from './scan.entity';
import { Supplier } from './supplier.entity';
import { QrCodeType, UserType, WalletType } from './user-type.entity';
import { User, UserRole } from './_user.model';
import { Vertical } from './vertical.entity';

export type QrCodeDocument = QrCode & Document;

export enum QrCodeKind {
  COMPOSED = 'COMPOSED',
  SINGLE = 'SINGLE',
  SINGLEBYQUANTITY = 'SINGLEBYQUANTITY',
}

export enum QrCodeTypeGenerator {
  INNER = 'INNER',
  OUTER = 'OUTER',
  QUANTIFIED = 'QUANTIFIED',
}

interface SupplierDetails {
  _id: string;
  name: string;
}

export enum TransferredFor {
  OPERATION = 'OPERATION',
  USERS = 'USERS',
}

export enum DisableIncentiveTypeEnum {
  INNER = 'INNER',
  OUTER = 'OUTER',
  ALL = 'ALL',
}

// Register enums for GraphQL
registerEnumType(QrCodeKind, {
  name: 'QrCodeKind',
});

registerEnumType(QrCodeTypeGenerator, {
  name: 'QrCodeTypeGenerator',
});

registerEnumType(TransferredFor, {
  name: 'TransferredFor',
});

registerEnumType(DisableIncentiveTypeEnum, {
  name: 'DisableIncentiveTypeEnum',
});

export interface ScanObject {
  action: ScanAction;
  scannedBy: UserScanInterFace;
  scannedFor: UserScanInterFace;
  userType: UserTypeData;
  purchasePoints: number;
  sellsPoints: number;
  usePoints: number;
  backwordPoints: number;
  backwordMoney: number;
  wheelPoints: number;
  fraudMessage: string;
  prodId: string;
  createdAt: Date;
  isActionMaker: boolean;
  walletType: WalletType;
  _id?: string;
  totalmoney?: number;
}

// Define WarehouseDetails schema
const warehouseDetailsSchema = new MongooseSchema(
  {
    warehouseId: {
      type: MongooseSchema.Types.ObjectId,
      required: false,
      index: true,
    },
    warehouseName: { type: String, required: false },
    userId: {
      type: MongooseSchema.Types.ObjectId,
      required: false,
      index: true,
    },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    phone: { type: String, required: false },
    dateIn: { type: Date, required: false },
    dateOut: { type: Date, required: false },
    hasScannedOutFromTheWarehouse: { type: Boolean, required: false },
    orderValue: { type: String, required: false },
    date: { type: Date, required: false },
    scanAction: {
      type: String,
      required: false,
      enum: Object.values(ScanAction),
    },
    userType: { type: String, required: false },
    transferredFor: {
      type: String,
      required: false,
      enum: Object.values(TransferredFor),
    },
  },
  { _id: true },
);

@ObjectType()
export class ProductData {
  @Field()
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
    index: true,
  })
  productId: string;

  @Field()
  @Prop({ type: Number })
  counter: number;
  
  @Field({ nullable: true })
  @Prop({ type: Number })
  outers?: number;
  
  @Field({ nullable: true })
  @Prop({ type: Number })
  pallets?: number;
  
  @Field({ nullable: true })
  @Prop({ type: Number })
  packages?: number;
}

@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      delete doc.__v;
      delete doc._id;
      return {
        ...doc,
      };
    },
  },
})
@ObjectType()
export class QrCode {
  @Field({ nullable: true })
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
    index: true,
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  productId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
    index: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: false,
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  product: string;

  @Prop(
    raw([
      {
        _id: false,
        id: {
          type: MongooseSchema.Types.ObjectId,
          ref: Product.name,
          required: false,
        },
        values: [
          {
            _id: false,
            key: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: Property.name, ///EDDITON
                required: false,
              },
              name: { type: String },
            },
            value: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: PropertyValue.name, ///EDDITON
                required: false,
              },
              name: { type: String },
              unit: {},
            },
          },
        ],
        name: { type: String },
        image: { type: String, required: false },
        counter: { type: Number, required: false },
      },
    ]),
  )
  products?: ExtendedProduct[];

  @Field({ nullable: true })
  @Prop({
    type: String,
    ref: QrCode.name,
    required: false,
  })
  directParent: string;

  @Field(() => [String], { nullable: true })
  @Prop({
    type: [String],
    ref: QrCode.name,
    required: false,
    each: true,
    index: true,
  })
  parents: string[];

  @Field()
  @Prop({ type: String, required: true, unique: true })
  value: string;

  @Prop({ type: String, trim: true })
  workerName: string;

  @Prop({ type: Number })
  productionsDate: number;

  @Prop({ type: String })
  link: string;

  @Prop({ type: Number, index: true })
  patch: number;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(QrCodeKind),
    index: true,
  })
  kind: QrCodeKind;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(QrCodeTypeGenerator),
    index: true,
  })
  type: QrCodeTypeGenerator | QrCodeType;

  @Prop({ type: String })
  operationBatch: string;

  @Prop({ type: Number })
  numberOfAgg: number;

  @Prop({ type: String })
  aggQrCode: string;

  @Prop({
    type: Boolean,
  })
  hasAgg: boolean;

  @Prop({
    type: Boolean,
  })
  isIncentive: boolean;

  @Field(() => [ProductData], { nullable: true })
  @Prop({
    type: [
      {
        productId: { type: MongooseSchema.Types.ObjectId },
        counter: Number,
        outers: Number,
        pallets: Number,
        packages: Number,
      },
    ],
    required: false,
    each: true,
  })
  productData: ProductData[];

  @Prop({
    type: { _id: { type: MongooseSchema.Types.ObjectId }, name: String },
    required: false,
    each: true,
    index: true,
  })
  supplierDetails: ExtendedSupplier;

  @Prop({
    type: { _id: { type: MongooseSchema.Types.ObjectId }, name: String },
    required: false,
    each: true,
  })
  verticalDetails: ExtendedVertical;

  @Prop({
    type: { _id: { type: MongooseSchema.Types.ObjectId }, name: String },
    required: false,
    each: true,
  })
  productTypeDetails: ExtendedProductType;

  @Prop({ type: String, required: true, unique: true })
  referenceNumber: string;

  @Field({ nullable: true })
  @Prop({ type: Boolean, index: true })
  isConfigured: boolean;

  @Prop({ type: Boolean, index: true })
  parentConfigured: boolean;

  @Prop({ type: Boolean })
  isOpend: boolean;

  @Prop({ type: Boolean })
  isOpendOrder: boolean;

  @Prop({ type: String, required: false })
  orderNum: string;

  @Prop({ type: Boolean, required: false })
  hasPallet: boolean;

  /*   @Prop({ type: Boolean, required: false })
  warehouseOut: boolean; */

  @Prop({ type: [warehouseDetailsSchema], default: [] })
  warehouseDetails?: WarehouseDetails[];

  @Prop({ type: Boolean, required: false })
  fromReset: boolean;

  @Prop({ type: String, required: false })
  imageUrl: string;

  @Prop({ type: Number, required: false })
  orderNumber: number;

  @Prop({ type: Boolean, default: false })
  isScanRun?: boolean;
  @Prop({ type: Boolean, default: false })
  hasWrongConfigrationPackage?: boolean;

  @Prop({ type: Boolean, default: false })
  hasWrongConfigrationPallet?: boolean;

  @Prop({ type: Date, required: false })
  configuredDate?: Date;

  @Prop({ type: Date, required: false })
  parentConfiguredDate?: Date;

  @Prop([
    {
      action: { type: String, enum: Object.values(ScanAction) },
      scannedBy: {
        id: {
          type: MongooseSchema.Types.ObjectId,
          ref: User.name,
          required: false,
          index: true,
        },
        firstName: {
          type: String,
          required: false,
        },
        lastName: {
          type: String,
          required: false,
        },
      },
      scannedFor: {
        id: {
          type: MongooseSchema.Types.ObjectId,
          ref: User.name,
          required: false,
          index: true,
        },
        firstName: {
          type: String,
          required: false,
        },
        lastName: {
          type: String,
          required: false,
        },
      },
      purchasePoints: { type: Number, default: 0 },
      sellsPoints: { type: Number, default: 0 },
      usePoints: { type: Number, default: 0 },
      backwordPoints: { type: Number, default: 0 },
      backwordMoney: { type: Number, default: 0 },
      wheelPoints: { type: Number, default: 0 },
      level: { type: Number, index: 1 },
      fraudMessage: { type: String },
      prodId: { type: MongooseSchema.Types.ObjectId, ref: Product.name },
      createdAt: { type: Date, default: new Date() },
      isActionMaker: { type: Boolean, default: false },

      walletType: {
        type: String,
        enum: Object.values(WalletType),
        required: false,
      },
      userType: {
        _id: {
          type: MongooseSchema.Types.ObjectId,
          ref: UserType.name,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        level: {
          type: Number,
          required: true,
        },
        isSubProfile: {
          type: Boolean,
          required: true,
        },
        parentProfile: {
          type: {},
          // ref: UserType.name,
          required: false,
        },
        role: {
          type: String,
          enum: Object.values(UserRole),
          required: false,
        },
      },
    },
  ])
  scanArray?: ScanObject[];

  @Prop({ type: Number, required: false })
  totalOuters?: number;
  @Prop({ type: Number, required: false })
  totalPallets?: number;
  @Prop({ type: Number, required: false })
  totalPackages?: number;

  @Prop({
    type: String,
    required: false,
    enum: Object.values(TransferredFor),
  })
  transferredFor?: TransferredFor; // in order

  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  isScannedOrderQrCode?: boolean;

  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  isDisableIncentiveOrder?: boolean;

  @Prop({
    type: String,
    required: false,
    enum: Object.values(DisableIncentiveTypeEnum),
  })
  disableIncentiveType?: DisableIncentiveTypeEnum;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  stampedToUserId?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  scannedBy?: string;

  @Prop({
    type: Date,
    required: false,
  })
  scannedAt?: Date;

  @Prop({ type: Number, required: false })
  quantifiedIncentivePoints: number;

  @Prop({ type: Number, required: false })
  quantifiedIncentiveWheel: number;
}

const QrCodeSchema = SchemaFactory.createForClass(QrCode);

// Optimized indexes for performance
QrCodeSchema.index({ supplier: 1, createdAt: -1 }); // Compound index for filtering by supplier and date
QrCodeSchema.index({ createdAt: 1 }); // Index for date-based queries
QrCodeSchema.index({ supplier: 1, 'scanArray.createdAt': 1 });
QrCodeSchema.index({ 'scanArray.userType._id': 1 });
QrCodeSchema.index({ 'productData.productId': 1 });
QrCodeSchema.index({ supplier: 1, 'scanArray.scannedFor.id': 1 });
QrCodeSchema.index({ supplier: 1, 'scanArray.prodId': 1 });
QrCodeSchema.index({ 'scanArray.scannedFor.id': 1, 'scanArray.action': 1 });
QrCodeSchema.index({ stampedToUserId: 1 });
QrCodeSchema.index({ scannedBy: 1 });

export { QrCodeSchema };
