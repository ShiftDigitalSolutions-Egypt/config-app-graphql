import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RedemptionMechanismDocument = RedemptionMechanism & Document;

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
export class RedemptionMechanism {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Boolean, default: false })
  isActive: boolean;
}

const RedemptionMechanismSchema =
  SchemaFactory.createForClass(RedemptionMechanism);

export { RedemptionMechanismSchema };
