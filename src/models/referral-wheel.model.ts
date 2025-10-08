import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Gift } from './gift.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type ReferralWheelDocument = ReferralWheel & Document;

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
export class ReferralWheel {
  @Prop({ type: String, required: true })
  referralWheelName: string;

  @Prop({ type: Number, required: true })
  referralWheelLength: number;

  @Prop(
    raw([
      {
        type: MongooseSchema.Types.ObjectId,
        ref: Gift.name,
        required: true,
      },
    ]),
  )
  giftIds: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Supplier.name, required: true })
  supplierId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Vertical.name, required: true })
  verticalId: string;
}

const ReferralWheelSchema = SchemaFactory.createForClass(ReferralWheel);

export { ReferralWheelSchema };
