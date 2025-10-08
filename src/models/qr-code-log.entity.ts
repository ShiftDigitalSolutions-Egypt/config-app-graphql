import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

import { ProductType } from './product-type.entity';
import { Product } from './product.entity';

import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { PackageAggregationLog } from './package-aggregation-log.entity';

import { QrCodeKind } from './qr-code.entity';
import { QrCodeTypeGenerator } from './qr-code.entity';
import { ScanAction } from './scan.entity';

export type QrCodeLogsDocument = QrCodeLog & Document;

export interface WarehouseDetails {
  warehouseId: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  warehouseName: string;
  hasScannedOutFromTheWarehouse?: boolean;
  date?: Date;
  scanAction: ScanAction;
  userType?: string;
}
class ProductData {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  productId: string;

  @Prop({
    type: Number,
  })
  counter: number;
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
export class QrCodeLog {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
    // autopopulate: false,
    // default: null
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
    // autopopulate: false,
    // default: null
  })
  productId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
    index: true,
    // autopopulate: false,
    // default: null
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: false,
    // autopopulate: false,
    // default: null
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
    // autopopulate: false,
    // default: null
  })
  product: string;

  @Prop({
    type: String,
    ref: QrCodeLog.name,
    required: false,
    // autopopulate: false,
    // default: null
  })
  directParent: string;

  @Prop({
    type: [String],
    ref: QrCodeLog.name,
    required: false,
    each: true,
    // autopopulate: false,
    // default: null
  })
  parents: string[];

  @Prop({
    type: String,
  })
  value: string;

  @Prop({
    type: String,
  })
  workerName: string;

  @Prop({
    type: Number,
  })
  productionsDate: number;

  @Prop({
    type: String,
  })
  link: string;

  @Prop({
    type: Number,
  })
  patch: number;

  @Prop({ required: false, type: String, enum: Object.values(QrCodeKind) })
  kind: QrCodeKind;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(QrCodeTypeGenerator),
  })
  type: QrCodeTypeGenerator;

  @Prop({
    type: String,
  })
  operationBatch: string;

  @Prop({
    type: Number,
  })
  numberOfAgg: number;

  @Prop({
    type: String,
  })
  aggQrCode: string;

  @Prop({
    type: Boolean,
  })
  hasAgg: boolean;

  @Prop({
    type: Boolean,
  })
  isIncentive: boolean;

  @Prop({
    type: [{ productId: { type: MongooseSchema.Types.ObjectId }, counter: Number }],
    required: false,
    each: true,
  })
  productData: ProductData[];

  @Prop({
    type: [String],
    ref: PackageAggregationLog.name,
    each: true,
    required: false,
  })
  qrCodeList: string[];

  @Prop({
    type: Boolean,
    required: false,
  })
  isPending: boolean;

  @Prop({ type: Boolean })
  isConfigured: boolean;

  @Prop({ type: Boolean })
  parentConfigured: boolean;

  @Prop({ type: String })
  errorMessage: string;

  @Prop({ type: Boolean, required: false })
  hasPallet: boolean;

  @Prop({ type: String, required: false })
  qrType: string;

  @Prop(
    raw([
      {
        warehouseId: { type: MongooseSchema.Types.ObjectId, required: false },
        warehouseName: { type: String, required: false },
        userId: { type: MongooseSchema.Types.ObjectId, required: false },
        firstName: { type: String, required: false },
        lastName: { type: String, required: false },
        phone: { type: String, required: false },
        date: { type: Date, required: false },
      },
    ]),
  )
  warehouseDetails: WarehouseDetails[];
}

const QrCodeLogsSchema = SchemaFactory.createForClass(QrCodeLog);

export { QrCodeLogsSchema };
