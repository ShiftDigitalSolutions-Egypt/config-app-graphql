import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Schema as MongooseSchema } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { User, UserDocument } from './_user.model';

export type ClientRequestDocument = ClientRequest & Document;

export enum SubjectType {
  USERGIFT = 'usergifts',
}

export enum RequestType {
  GIFTS = 'GIFTS',
  CASHINCENTIVE = 'CASHINCENTIVE',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DELIVERED = 'DELIVERED',
  TRANSFERRED = 'TRANSFERRED',
}
@Schema({
  discriminatorKey: 'type',
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
export class ClientRequest {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'users',
    required: true,
  })
  user?: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: District.name,
    required: true,
  })
  district?: string | DistrictDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Governorate.name,
    required: true,
  })
  governorate?: string | GovernorateDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  acceptedBy?: string | UserDocument;

  @Prop({ required: false, type: String, enum: Object.values(RequestType) })
  type?: RequestType;

  @Prop({ required: false, type: String, enum: Object.values(RequestStatus) })
  status?: RequestStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    default: null,
    // required: true,
  })
  deliveredBy?: string | UserDocument;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  inc?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
const ClientRequestSchema = SchemaFactory.createForClass(ClientRequest);
export { ClientRequestSchema };
