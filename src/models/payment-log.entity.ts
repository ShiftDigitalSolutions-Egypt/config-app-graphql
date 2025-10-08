import { Prop, Schema, SchemaFactory, DiscriminatorOptions, raw } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Gift, GiftDocument } from './gift.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { Supplier, SupplierDocument } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { Segment } from './segment.entity';
import { TrackType, UserTrack } from './track-type.entity';
import { UserType } from './user-type.entity';
import { Wheel } from './wheel.entity';
import { User, UserDocument } from './_user.model';

export type PaymentLogDocument = PaymentLog & Document;

export enum PriceColums {
  basePrice = 'basePrice',
  rate = 'rate',
  provision = 'provision',
  finalPrice = 'finalPrice',
}

export enum PaymentTransactionType {
  BANK = 'BANK',
  WALLET = 'WALLET',
}

export enum PaymentTransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING'
}

// export class PriceInfo {
//     @Prop({ type: Number, required: false })
//     providerFees: number;

//     @Prop({ type: Number, required: false })
//     adminFees: number;

//     @Prop({ type: String, required: false })
//     transactionId: string;

//     @Prop({ type: String, required: false })
//     issuer: string;

//     @Prop({ type: Number, required: false })
//     amount: number;

//     @Prop({ type: String, required: false })
//     bankCardNumber: string;

//     @Prop({ type: String, required: false })
//     bankCode: string;

//     @Prop({ type: String, required: false })
//     msisdn: string;

//     country: string;
//     supplier: string;
//     user: string;

//     // @Prop({ type: Number, required: false, default: 0 })
//     // provision: number;

//     // @Prop({ type: Number, required: false })
//     // finalPrice: number;
// }
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
export class PaymentLog {
  id?: string;

  @Prop({ required: true, type: String, enum: Object.values(PaymentTransactionType) })
  transactionType: PaymentTransactionType;

  @Prop({ type: Number, required: true }) //todo for any provider fees eg paymob,
  providerFees: number;

  @Prop({ type: Number, required: true }) //todo for qara fees
  adminFees: number;

  @Prop({ type: String, required: true })
  transactionId: string;

  // @Prop({ type: String, required: false })
  // firstName: string;

  // @Prop({ type: String, required: false })
  // lastName: string;

  // @Prop({ type: String, required: false })
  // email: string;

  @Prop({ type: String, required: true })
  issuer: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: false })
  bankCardNumber: string;

  @Prop({ type: String, required: false })
  bankCode: string;

  @Prop({ type: String, required: false })
  msisdn: string;

  @Prop({ type: String, required: false, enum: Object.values(PaymentTransactionStatus) })
  status: PaymentTransactionStatus;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true })
  provider: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string | SupplierDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: string | UserDocument;

  @Prop({ type: String, required: false })
  reference_id?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  requestResponse?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  callbackResponse?: any;
}

const PaymentLogSchema = SchemaFactory.createForClass(PaymentLog);

// Create indexes for performance optimization
PaymentLogSchema.index({ supplier: 1, createdAt: -1 }); // Compound index for filtering by supplier and date
PaymentLogSchema.index({ createdAt: 1 }); // Index for date-based queries

export { PaymentLogSchema };
