import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Product } from './product.entity';

export type PauseSessionDocument = PauseSession & Document;

export enum PauseSessionStatus {
  START = 'START',
  PAUSE = 'PAUSE',
  INPROGRESS = 'INPROGRESS',
  EDITED = 'EDITED',
  FINSHED = 'FINSHED',
}

export interface ExtendedProduct {
  id: string;
  productId: string;
  values: [
    {
      key: {
        _id: string;
        name: string;
      };
      value: {
        _id: string;
        name: string;
        unit: string;
      };
    },
  ];
  name: string;
  image: string;
  createdAt: number;
  hasAggregation: boolean;
  hasOrderNumber: boolean;
  hasPallet: boolean;
  hasPatch: boolean;
  hasProductionDate: boolean;
  isGuided: boolean;
  isPalletAvailable: boolean;
  numberOfAggregations: number;
  numberOfPallet: number;
  orderNumber: string;
  patchId: string;
  expirationDate: number;
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
export class PauseSession {
  id?: string;

  @Prop({ type: String, required: true, unique: true })
  palletQrCode: string;

  @Prop({ type: Number, required: true })
  totalPackages: number;

  @Prop({ type: [String], required: true })
  packagesList: string[];

  @Prop(
    raw({
      _id: false,
      productParentType: {
        type: String,
        required: true,
      },
      productName: {
        type: String,
        required: true,
      },
      code: {
        type: String,
        required: true,
      },
      productId: {
        type: String,
        required: true,
      },
      productValueList: [
        {
          _id: false,
          key: {
            type: String,
            required: true,
          },
          value: {
            type: String,
            required: true,
          },
        },
      ],
      createdAt: { type: Number, required: true },
      hasAggregation: { type: Boolean, required: true },
      hasOrderNumber: { type: Boolean, required: true },
      hasPallet: { type: Boolean, required: true },
      hasPatch: { type: Boolean, required: true },
      hasProductionDate: { type: Boolean, required: true },
      image: { type: String, required: true },
      isGuided: { type: Boolean, required: true },
      isPalletAvailable: { type: Boolean, required: true },
      numberOfAggregations: { type: Number, required: true },
      numberOfPallet: { type: Number, required: true },
      orderNumber: { type: String, required: false },
      patchId: { type: String, required: false },
      expirationDate: { type: Number, required: true },
    }),
  )
  product: ExtendedProduct;

  @Prop({ type: String, required: false, index: true })
  supplier: string;

  @Prop({ type: String, required: false, index: true })
  vertical: string;

  @Prop({ type: String, required: false })
  workerName: string;

  @Prop({ type: String, enum: Object.values(PauseSessionStatus), required: false, index: true })
  status: PauseSessionStatus;

  @Prop({
    type: String,
    required: true,
  })
  ssid: string;

  @Prop({ type:  Boolean , required: false })
  isFixed: boolean;

  @Prop({ type: Boolean, required: false })
  isReported: boolean;
}

export const PauseSessionSchema = SchemaFactory.createForClass(PauseSession);
