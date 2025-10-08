import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { User, UserDocument } from './_user.model';

export enum ScanQrResultStatus {
  Original = 'Original',
  NonOriginal = 'NonOriginal',
  NotConfigured = 'NotConfigured',
  ScannedBeforeBySameUser = 'ScannedBeforeBySameUser',
  ScannedBeforeByAnotherUser = 'ScannedBeforeByAnotherUser',
  ScannedByNotStampedUser = 'ScannedByNotStampedUser',
}

export enum QrType {
  Outer = 'OUTER',
  Inner = 'INNER',
  Package = 'PACKAGE',
  Pallet = 'PALLET',
  Order = 'ORDER',
  None = 'NONE',
  QUANTIFIED = 'QUANTIFIED',
}

export enum RequestStatus {
  Success = 'Success',
  Failure = 'Failure',
}

export enum ScanOperation {
  SCANIN = 'ScanIn',
  SCANOUT = 'ScanOut',
  SCANUSE = 'ScanUse',
}

export enum TypeOfOperation {
  AUTHENTICATE = 'AUTHENTICATE',
  SCAN = 'SCAN',
}

export type ScanHistoryDocument = ScanHistory & Document;
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
export class ScanHistory {
  id?: string;

  @Prop({
    type: String,
    required: true,
  })
  qrCode: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    index: true,
  })
  user?: string | UserDocument;

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(QrType),
  })
  type: QrType;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(ScanQrResultStatus),
  })
  status: ScanQrResultStatus;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(RequestStatus),
  })
  requestStatus: RequestStatus;

  @Prop({
    type: String,
    enum: Object.values(ScanOperation),
  })
  scanOperation: ScanOperation;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(TypeOfOperation),
  })
  typeOfOperation: TypeOfOperation;

  @Prop({
    type: String,
  })
  ssid: string;

  @Prop({
    type: String,
  })
  userId: string;
}
const ScanHistorySchema = SchemaFactory.createForClass(ScanHistory);
export { ScanHistorySchema };
