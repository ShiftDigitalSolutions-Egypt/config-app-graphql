import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { Schema as MongooseSchema, Document } from 'mongoose';

export enum GiftType {
  VOUCHER = 'VOUCHER',
  GIFT = 'GIFT',
  CASH = 'CASH',
}

export enum OptionType {
  TRANSFER_TO_WALLET = 'TRANSFER_TO_WALLET',
  REDEEM_GIFT = 'REDEEM_GIFT',
}

export type GiftDocument = Gift & Document;

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
export class Gift {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  photo: string;

  @Prop({ type: Number })
  value: number;

  @Prop({ type: String, required: false })
  vendor?: string;

  @Prop({ type: String, enum: Object.values(GiftType), required: true })
  giftType: GiftType;

  @Prop({ type: [String], enum: Object.values(OptionType), default: [] })
  optionControl: OptionType[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;
}

const GiftSchema = SchemaFactory.createForClass(Gift);

export { GiftSchema };
