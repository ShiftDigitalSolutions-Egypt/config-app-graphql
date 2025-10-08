import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Product } from './product.entity';
import { ScanObject } from './qr-code.entity';
import { ScanAction } from './scan.entity';
import { ExtendedProductType } from './scan.entity';
import { Supplier } from './supplier.entity';
import { UserType, WalletType } from './user-type.entity';
import { User, UserRole } from './_user.model';
import { Warehouse } from './warehouse.entity';

export type ReturnSystemDocument = ReturnSystem & Document;
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
export class ReturnSystem {
  id?: string;

  @Prop({ type: String })
  qrcode: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string;

  @Prop({
    type: { _id: { type: MongooseSchema.Types.ObjectId }, name: String },
    required: false,
    each: true,
  })
  productTypeDetails?: ExtendedProductType;

  @Prop([
    {
      qrcode: { type: String },
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
      walletType: { type: String, enum: Object.values(WalletType), required: false },
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

  @Prop([
    {
      qrcode: { type: String },
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
      walletType: { type: String, enum: Object.values(WalletType), required: false },
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
  scanArrayOfParent?: ScanObject[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Product.name, required: false })
  products?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Warehouse.name,
    required: false,
  })
  warehouseId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  warehouseUserId: string;

  @Prop({
    type: Boolean,
  })
  isReturnInner?: boolean

  @Prop({ type: String })
  innerqr?: string
}

const ReturnSystemSchema = SchemaFactory.createForClass(ReturnSystem);

export { ReturnSystemSchema };
