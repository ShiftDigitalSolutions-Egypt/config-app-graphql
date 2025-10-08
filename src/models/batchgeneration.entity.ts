import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Product } from './product.entity';
import { Schema as MongooseSchema } from 'mongoose';
export enum QrCodeType {
  INNEROUTER = 'INNEROUTER',
  COMPOSED = 'COMPOSED',
  SINGLE = 'SINGLE',
  SINGLEBYQUANTITY = 'SINGLEBYQUANTITY',
}

export enum ComposedType {
  PACKAGE = 'PACKAGE',
  PALLET = 'PALLET',
}

export enum BatchStatus {
  FETCHING = 'FETCHING',
  PENDING = 'PENDING',
  FINISHED = 'FINISHED',
  DRAFT = 'DRAFT',
  REJECTED = 'REJECTED',
  CONFIGURED = 'CONFIGURED',
  NOTCONFIGURED = 'NOTCONFIGURED',
}

export enum StatusOfGenerateFile {
  INPROCESS = 'INPROCESS',
  FAILED = 'FAILED',
  COMPLETE = 'COMPLETE',
}

export type BatchgenerationDocument = Batchgeneration & Document;

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
export class Batchgeneration {
  id?: string;

  @Prop({ type: String })
  appLink: string;

  @Prop({ type: String })
  flag: string;

  @Prop({ type: String })
  patchDetails: string;

  @Prop({
    type: Number,
    index: true,
  })
  patch: number;

  @Prop({ type: Number })
  quantity: number;

  @Prop({ type: Number, required: false, default: 0 })
  fetchingQuantity: number;

  @Prop({ type: String, required: false })
  whyRejected: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(QrCodeType),
  })
  qrType: QrCodeType;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(BatchStatus),
  })
  status: BatchStatus;

  @Prop({ type: Date, required: false })
  startDate?: Date;

  @Prop({ type: Date, required: false })
  endDate?: Date;

  @Prop({ type: String, required: false })
  downloadLink: string;

  @Prop({ type: String, required: false, enum: Object.values(ComposedType) })
  composedType: ComposedType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  product?: string;

  @Prop({
    type: Number,
  })
  productionDate?: number;
  @Prop({
    type: String,
  })
  orderNum?: string;
  @Prop({
    type: String,
  })
  operationBatch?: string;

  @Prop({
    type: String,
    required: false,
    enum: Object.values(StatusOfGenerateFile),
  })
  statusOfGenerateFile?: StatusOfGenerateFile;

  @Prop({ type: Boolean })
  isQuantified: boolean;
}

const BatchgenerationSchema = SchemaFactory.createForClass(Batchgeneration);

export { BatchgenerationSchema };
