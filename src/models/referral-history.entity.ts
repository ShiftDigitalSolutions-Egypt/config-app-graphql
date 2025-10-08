import { Schema as MongooseSchema, Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ReferralModelName } from './referral-model.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type ReferralHistoryDocument = ReferralHistory & Document;

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
export class ReferralHistory {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplierId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  verticalId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  referringUserTypeId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  referredUserTypeId: string;

  @Prop({
    type: String,
    required: false,
    enum: Object.values(ReferralModelName),
  })
  modelTypeName: ReferralModelName;

  @Prop({ type: String, required: true })
  affectedField: string;

  @Prop({ type: Number, required: true })
  oldValue: number;

  @Prop({ type: Number, required: true })
  newValue: number;
}

const ReferralHistorySchema = SchemaFactory.createForClass(ReferralHistory);

export { ReferralHistorySchema };
