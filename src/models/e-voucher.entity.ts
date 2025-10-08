import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserDocument } from './_user.model';
import mongoosePaginate from 'mongoose-paginate-v2';
import { ClientRequestDocument } from './_client-request.entity';

export type EVoucherDocument = EVoucher & Document;

export enum VoucherType {
  CASH = 'CASH',
}

export interface UserInterFace {
  id: string | UserDocument;
  userId: number;
}

export enum VoucherStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  USED = 'USED',
}

export interface ObjectExtended {
  name: string;
  id: string;
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
export class EVoucher {
  id?: string;

  @Prop({ type: Number })
  patchId: number;

  @Prop({ type: String })
  code: string;

  @Prop({ type: String })
  vendorName: string;

  @Prop({ type: Number })
  value: number;

  @Prop({ type: Boolean, default: true, required: false }) //todo  if we need to desable voucher
  enabled: boolean;

  @Prop({ enum: VoucherStatus, default: VoucherStatus.AVAILABLE })
  status: VoucherStatus;

  @Prop({ enum: VoucherType, default: VoucherType.CASH })
  type: VoucherType;

  @Prop({ type: Date })
  startDate: Date;

  @Prop({ type: Date })
  expirationDate: Date;

  // @Prop({
  //     type: MongooseSchema.Types.ObjectId,
  //     ref: 'users',
  //     required: false,
  // })
  // user?: string | UserDocument;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: 'users',
        required: false,
      },
      userId: {
        type: Number,
        required: false,
      },
    }),
  )
  user?: UserInterFace;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'clientRequests',
    required: false,
  })
  clientRequest?: string | ClientRequestDocument;

  @Prop({ type: Date })
  scannedAt: Date;
}

export const EVoucherSchema = SchemaFactory.createForClass(EVoucher);
EVoucherSchema.plugin(mongoosePaginate);
