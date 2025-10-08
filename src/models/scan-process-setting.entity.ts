import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';

export type ScanProcessSettingDocument = ScanProcessSetting & Document;
@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      //prevent this fields from returning in a response
      delete doc.__v;
      delete doc._id;
      return {
        ...doc,
      };
    },
  },
})
export class ScanProcessSetting {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: Boolean,
    default: false,
    required: true,
  })
  allowSkipScanIn: boolean;

  @Prop({
    type: Boolean,
    default: true,
    required: true,
  })
  itemLevelAggregation: boolean;

  @Prop({
    type: Boolean,
    default: false,
    required: true,
  })
  quantitLevelyAggregation: boolean;
}
const ScanProcessSettingSchema =
  SchemaFactory.createForClass(ScanProcessSetting);
export { ScanProcessSettingSchema };
