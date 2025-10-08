import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import mongoose, { Document, Types } from 'mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type SupplierDeviceDocument = Document & SupplierDevice;

@Schema({ timestamps: false, _id: false })
export class DeviceDetails {
  @Prop({ type: String, required: true })
  verificationCode: string;

  @Prop({ type: String, required: true })
  deviceName: string;

  @Prop({ type: Boolean, required: false, default: false })
  isScanned?: boolean;

  @Prop({ type: Boolean, required: false, default: true })
  enabled?: boolean;
}

@Schema({
  timestamps: true,
  _id: true,
})
export class SupplierDevice {
  readonly _id;

  @Prop([DeviceDetails])
  deviceDetails: DeviceDetails[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: Supplier.name })
  @Type(() => Supplier)
  supplier: Supplier | Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: Vertical.name })
  @Type(() => Vertical)
  vertical: Vertical | Types.ObjectId;

  @Prop({ type: Number })
  numberOfDevices: number;

  @Prop({ type: Number, required: true, unique: true })
  transactionId: number;
}

export const SupplierDeviceSchema = SchemaFactory.createForClass(SupplierDevice);
