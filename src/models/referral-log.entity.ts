import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ReferralModelName } from './referral-model.entity';
import { User } from './_user.model';

export type ReferralLogDocument = ReferralLog & Document;

export interface ReferralUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
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
export class ReferralLog {
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    }),
  )
  referringUser: ReferralUser;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    }),
  )
  referredUser: ReferralUser;

  @Prop({
    type: String,
    required: true,
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

  @Prop({ type: Number, required: true })
  referralWallet: number;
}

const ReferralLogSchema = SchemaFactory.createForClass(ReferralLog);
export { ReferralLogSchema };
