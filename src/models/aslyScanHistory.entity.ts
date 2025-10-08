import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

export enum AslyScanQrResultStatus {
  Original = 'Original',
  NonOriginal = 'NonOriginal',
  NotConfigured='NotConfigured',
  InnerScannedBeforeBySameDevice = "InnerScannedBeforeBySameDevice",
  InnerScannedBeforeByAnotherDevice = "InnerScannedBeforeByAnotherDevice"
}

export enum AslyQrType {
  Outer = 'OUTER',
  Inner = 'INNER',
  None = 'NONE',
  PALLET = 'PALLET',
  PACKAGE = 'PACKAGE',
  ORDER = 'ORDER',
}
export type AslyScanHistoryDocument = AslyScanHistory & Document;
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
export class AslyScanHistory {
  id?: string;

  @Prop({
    type: String,
    required: true,
  })
  qrCode: string;

  @Prop({
    type: String,
    required: true,
  })
  ssid: string;

  @Prop({
    type: String,
    required: false,
  })
  userId?: string;

  @Prop({
    type: String,
    required: true,
  })
  operatingSystem: string;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(AslyQrType),
  })
  type: AslyQrType;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(AslyScanQrResultStatus),
  })
  status: AslyScanQrResultStatus;
}
const AslyScanHistorySchema = SchemaFactory.createForClass(AslyScanHistory);
export { AslyScanHistorySchema };
