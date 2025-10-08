import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { QrCode, QrCodeDocument } from './qr-code.entity';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';

import { User, UserDocument } from './_user.model';
import { Product, ProductDocument } from './product.entity';
import { Actions } from './user-type.entity';
import { ProductType, ProductTypeDocument } from './product-type.entity';

export type HoldInventiveLogDocument = HoldInventiveLog & Document;

export enum TransactionStatus {
  PENDING = 'PENDING',
  TRANSFERED = 'TRANSFERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum TransactionType {
  SCANIN = 'SCANIN',
  SCANOUT = 'SCANOUT',
  SCANUSE = 'SCANUSE',
}

export enum TransactionValueType {
  POINTS = 'POINTS',
  CASH = 'CASH',
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
export class HoldInventiveLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user?: string | UserDocument | ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
  })
  product?: string | ProductDocument | ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: true,
  })
  productType?: string | ProductTypeDocument | ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: QrCode.name,
    required: false,
  })
  qrCode?: string | QrCodeDocument | ObjectId;

  @Prop({ type: Number, required: true })
  transactionValue: number;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(TransactionStatus),
  })
  transactionStatus?: TransactionStatus;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(TransactionValueType),
    default: TransactionValueType.CASH,
  })
  transactionValueType?: TransactionValueType;

  @Prop({ required: true, type: String, enum: Object.values(TransactionType) })
  transactionType?: TransactionType;

  @Prop({ required: true, type: String, enum: Object.values(Actions) })
  action?: Actions;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: String, required: false })
  comment?: string;

  @Prop({ type: Number, required: false })
  durationDays?: number;

  @Prop({ type: Boolean, default: false })
  qrCodeReturned?: boolean;
}
const HoldInventiveLogSchema = SchemaFactory.createForClass(HoldInventiveLog);
HoldInventiveLogSchema.index({ user: 1 });
export { HoldInventiveLogSchema };
