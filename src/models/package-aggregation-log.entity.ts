import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { QrCode, QrCodeKind, QrCodeTypeGenerator } from './qr-code.entity';

export type UnitDocument = PackageAggregationLog & Document;

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
export class PackageAggregationLog {
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
    required: false,
  })
  isPending: boolean;

  @Prop({
    type: String,
  })
  workerName: string;

  @Prop({
    type: Number,
  })
  productionsDate: number;

  @Prop({
    type: Number,
  })
  sessionCount: number;
}

const PackageAggregationLogSchema = SchemaFactory.createForClass(PackageAggregationLog);

export { PackageAggregationLogSchema };
