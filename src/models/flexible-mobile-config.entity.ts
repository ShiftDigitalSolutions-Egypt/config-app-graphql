import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type FlexibleMobileConfigDocument = FlexibleMobileConfig & Document;

@Schema({
  timestamps: true,
  collection: 'mobile_app_configurations',
})
export class FlexibleMobileConfig {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  app_name: string;

  @Prop({
    type: SchemaTypes.Mixed,
    required: true,
  })
  config_data: any;

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt?: Date;
}

export const FlexibleMobileConfigSchema =
  SchemaFactory.createForClass(FlexibleMobileConfig);

// Create indexes
FlexibleMobileConfigSchema.index({ app_name: 1 });
FlexibleMobileConfigSchema.index({ createdAt: 1 });
FlexibleMobileConfigSchema.index({ updatedAt: 1 });
