import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

export type ReferralModelDocument = ReferralModel & Document;

export enum ReferralModelName {
  RECURRING = 'Recurring Reward',
  ONETIME = 'One-Time Reward',
}

export enum OneTimeWheelGift {
  Game = 'Game',
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
export class ReferralModel {
  @Prop({
    type: String,
    required: false,
    enum: Object.values(ReferralModelName),
  })
  modelTypeName: ReferralModelName;

  @Prop({ type: Number, required: false })
  percentagePerScan: number;

  @Prop({ type: Number, required: false })
  referralPeriod: number;

  @Prop({ type: Number, required: false })
  referralRewardValue: number;

  @Prop({ type: Number, required: false })
  minConsumption: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  supplierId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  verticalId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  referringUserTypeId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  referredUserTypeId: string;

  @Prop({ type: String, required: true, enum: Object.values(OneTimeWheelGift) })
  rewardType: OneTimeWheelGift;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  referralWheelId: string;
}

const ReferralModelSchema = SchemaFactory.createForClass(ReferralModel);

export { ReferralModelSchema };
