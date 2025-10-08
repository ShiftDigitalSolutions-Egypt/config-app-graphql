import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, Schema as MongooseSchema } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';

export interface supplierObjectExtended {
  id: ObjectId;
  name: string;
}

export interface userTypeObjectExtended {
  id: ObjectId;
  name: string;
}

export interface cashbackHistoryObject {
  createdAt: Date;
  changedAt: Date;
  title: String;
  description: String;
  percentage: number;
  numberOfDays: number;
  idIncrement: number;
}
export type MarketPlaceCashbackConfigurationDocument =
  MarketPlaceCashbackConfiguration & Document;
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
export class MarketPlaceCashbackConfiguration {
  @Prop({ type: Number, required: true, unique: true })
  idIncrement: number;
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
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: Supplier.name,
        required: true,
      },
      name: { type: String, required: true },
    }),
  )
  supplier: supplierObjectExtended;

  @Prop(
    raw({
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: true,
      },
      name: { type: String, required: true },
    }),
  )
  userType: userTypeObjectExtended;

  @Prop({
    type: [
      {
        createdAt: { type: Date, required: true },
        changedAt: { type: Date, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        percentage: { type: Number, required: true },
        numberOfDays: { type: Number, required: true },
        idIncrement: { type: Number, required: true },
      },
    ],
    default: [],
    required: true,
  })
  cashbacksHistory: cashbackHistoryObject[];
  @Prop({ type: Date, required: true })
  LastAddedAt: Date;
  @Prop({ type: Boolean, required: true, default: false })
  isActive: boolean;
  @Prop({ type: Boolean, default: true })
  isLatest: boolean;
}

export const MarketPlaceCashbackConfigurationSchema =
  SchemaFactory.createForClass(MarketPlaceCashbackConfiguration);
