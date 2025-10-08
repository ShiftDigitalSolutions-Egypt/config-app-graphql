import { Prop, Schema, SchemaFactory, DiscriminatorOptions, raw } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Gift, GiftDocument } from './gift.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { Segment } from './segment.entity';
import { TrackType, UserTrack } from './track-type.entity';
import { UserType } from './user-type.entity';
import { UserRole } from './_user.model';
import { Wheel } from './wheel.entity';

export type PriceListDocument = PriceList & Document;

export enum PriceColums {
  basePrice = 'basePrice',
  rate = 'rate',
  provision = 'provision',
  finalPrice = 'finalPrice',
}

export class PriceInfo {
  @Prop({ type: Number, required: false })
  basePrice: number;

  @Prop({ type: Number, required: false })
  rate: number;

  @Prop({ type: Number, required: false, default: 0 })
  provision: number;

  @Prop({ type: Number, required: false })
  finalPrice: number;
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
export class PriceList {
  id?: string;

  @Prop()
  priceInfo: PriceInfo;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: ProductType.name, required: false })
  productType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Product.name, required: false })
  product: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Supplier.name, required: false })
  supplier: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Vertical.name, required: false })
  vertical: string;

  @Prop({ type: Boolean, required: false })
  rabehIncentiveToEnergyaProduct: boolean;
}

const PriceListSchema = SchemaFactory.createForClass(PriceList);

export { PriceListSchema };
