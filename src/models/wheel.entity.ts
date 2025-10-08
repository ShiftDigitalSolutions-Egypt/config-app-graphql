import {
  Prop,
  Schema,
  SchemaFactory,
  DiscriminatorOptions,
  raw,
} from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { Gift, GiftDocument } from './gift.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type WheelDocument = Wheel & Document;

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
export class Wheel {
  id?: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true })
  wheelLength: number;

  @Prop({ type: Number, required: false, min: 1 })
  duplicationNumber: number;

  @Prop({ type: Number, required: false })
  groupId: number;

  @Prop(
    raw([
      {
        type: MongooseSchema.Types.ObjectId,
        ref: Gift.name,
        required: true,
      },
    ]),
  )
  gifts: string[];

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

  @Prop({ default: false, type: Boolean })
  isReferralWheel?: boolean;
}

const WheelSchema = SchemaFactory.createForClass(Wheel);

export { WheelSchema };
