import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId, Schema as MongooseSchema, Document } from 'mongoose';
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

export type MarketPlaceWalletCofigurationDocument = MarketPlaceWalletCofiguration & Document;

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
export class MarketPlaceWalletCofiguration {
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
    type: Number,
    required: true,
  })
  minimumAmount: number;
  @Prop({
    type: Number,
    required: true,
  })
  deductionPercentage: number;
}
export const MarketPlaceWalletCofigurationSchema = SchemaFactory.createForClass(MarketPlaceWalletCofiguration);
