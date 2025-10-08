import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { RedemptionMechanism } from './redemption-mechanism.entity';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';

export type RedemptionMechanismConfigurationDocument =
  RedemptionMechanismConfiguration & Document;

// Sub-schema for redemption mechanism items
@Schema({ _id: false })
export class RedemptionMechanismItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: RedemptionMechanism.name,
    required: true,
  })
  id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  key: string;
}

const RedemptionMechanismItemSchema = SchemaFactory.createForClass(
  RedemptionMechanismItem,
);

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
export class RedemptionMechanismConfiguration {
  @Prop([RedemptionMechanismItemSchema])
  redemptionMechanisms: RedemptionMechanismItem[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

const RedemptionMechanismConfigurationSchema = SchemaFactory.createForClass(
  RedemptionMechanismConfiguration,
);

// Add indexes for efficient querying
RedemptionMechanismConfigurationSchema.index(
  { userType: 1, supplier: 1 },
  { unique: true },
);
RedemptionMechanismConfigurationSchema.index({ supplier: 1 });
RedemptionMechanismConfigurationSchema.index({ 'redemptionMechanisms.id': 1 });

export { RedemptionMechanismConfigurationSchema };
