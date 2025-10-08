import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type PalletAggregationDocument = PalletAggregationLog & Document;

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
export class PalletAggregationLog {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  productId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
    index: true,
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
    type: Number,
  })
  sessionCount: number;

  @Prop({
    type: String,
  })
  workerName: string;
}

const PalletLogsSchema = SchemaFactory.createForClass(PalletAggregationLog);

export { PalletLogsSchema };
