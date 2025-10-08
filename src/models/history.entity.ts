import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { Incentive } from './incentive.entity';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { PriceList } from './price-list.entity';
import { UserType } from './user-type.entity';

export type HistoryDocument = History & Document;

export enum HistoryType {
  INCENTIVE = 'INCENTIVE',
  PRICELIST = 'PRICELIST',
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
export class History {
  id?: string;

  @Prop({ type: String, required: true })
  fieldTitle: string;

  @Prop({ type: Number, required: true })
  oldValue: number;

  @Prop({ type: Number, required: true })
  newValue: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: false,
    default: null,
  })
  user: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
    default: null,
  })
  actionFrom?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
  })
  product: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: false,
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;

  @Prop({ required: true, type: String, enum: Object.values(HistoryType) })
  historyType: HistoryType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: PriceList.name,
    required: false,
  })
  priceList: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Incentive.name,
    required: false,
  })
  incentive: string;

  @Prop({ type: Boolean, required: false, default: false })
  parentSupplier: boolean;
}

const HistorySchema = SchemaFactory.createForClass(History);

export { HistorySchema };
