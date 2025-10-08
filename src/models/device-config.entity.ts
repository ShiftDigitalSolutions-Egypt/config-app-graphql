import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type DeviceConfigDocument = DeviceConfig & Document;

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
export class DeviceConfig {
  id?: string;

  @Prop({ type: String, required: false, index: true })
  ssid?: string;

  @Prop({ type: String, required: false })
  deviceName?: string;

  @Prop({ type: String, required: false })
  deviceType?: string;

  @Prop({ type: String, required: true })
  verificationCode: string;

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

  @Prop({ type: Boolean, default: true })
  enabled?: boolean;
}

const DeviceConfigSchema = SchemaFactory.createForClass(DeviceConfig);

export { DeviceConfigSchema };
