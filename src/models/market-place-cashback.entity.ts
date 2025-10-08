import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { MarketPlaceOrder } from './market-place-order.entity';
import {
  supplierObjectExtended,
  userTypeObjectExtended,
} from './market-place-wallet-cofiguration.entity';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';
import { User, UserDocument } from './_user.model';
import { CashbackStatusEnum } from '../enums/cashback-status.enum';

export type MarketPlaceCashbackDocument = MarketPlaceCashback & Document;

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
export class MarketPlaceCashback {
  @Prop({ type: Number, required: true })
  cashbackId: number;
  @Prop({ type: String, required: true })
  title: string;
  @Prop({ type: String, required: true })
  description: string;
  @Prop({ type: Number, required: true })
  percentage: number;
  @Prop({ type: Number, required: true })
  numberOfDays: number;
  @Prop({ type: Boolean, required: true, default: true })
  isOneTimeUse: boolean;
  @Prop(
    raw({
      id: { type: MongooseSchema.Types.ObjectId, ref: Supplier.name, required: true },
      name: { type: String, required: true },
    }),
  )
  supplier: supplierObjectExtended;

  @Prop(
    raw({
      id: { type: MongooseSchema.Types.ObjectId, ref: UserType.name, required: true },
      name: { type: String, required: true },
    }),
  )
  userType: userTypeObjectExtended;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user?: string | UserDocument;
  @Prop({
    type: Number,
    required: true,
  })
  cashbackAmount: number;
  @Prop({
    type: Date,
  })
  deliveredAt: Date;
  @Prop({
    type: Date,
  })
  deliverAt: Date;
  @Prop({
    type: Boolean,
    default: false,
  })
  isDelivered: boolean;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MarketPlaceOrder.name,
    required: true,
  })
  orderId?: string;
  @Prop({
    type: String,
    default: CashbackStatusEnum.IN_PROGRESS,
    enum: CashbackStatusEnum,
  })
  cashbackStatus: CashbackStatusEnum;
}
export const MarketPlaceCashbackSchema = SchemaFactory.createForClass(MarketPlaceCashback);
