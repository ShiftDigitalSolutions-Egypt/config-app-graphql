import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { PriceList } from './price-list.entity';
import { Segment } from './segment.entity';
import { UserType } from './user-type.entity';
import { Product } from './product.entity';

export enum WalletType {
  POINTS = 'POINTS',
  CASH = 'CASH',
}

export enum Actions {
  PURCHASE = 'PURCHASE',
  SELLS = 'SELLS',
  USE = 'USE',
  REWARD = 'REWARD',
}

export enum GroupName {
  BaseIncentive = 'baseInsentive',
  RewardStreams = 'rewardStreams',
  Segmentations = 'segmentation',
}

export enum BaseIncentiveColumns {
  profitMargin = 'profitMargin',
  baseIncentiveAllownace = 'baseIncentiveAllownace',
  incentiveTotal = 'incentiveTotal',
}

export enum RewardStreamsColumns {
  PURCHASEWheel = 'PURCHASEWheel',
  PURCHASEWallet = 'PURCHASEWallet',
  SELLSWheel = 'SELLSWheel',
  SELLSWallet = 'SELLSWallet',
  USEWheel = 'USEWheel',
  USEWallet = 'USEWallet',
  REWARDWheel = 'REWARDWheel',
  REWARDWallet = 'REWARDWallet',
}

export enum UpdatedFieldType {
  Oject = 'Oject',
  Array = 'Array',
}

export type IncentiveDocument = Incentive & Document;

export class BaseIncentive {
  @Prop({ type: Number, required: false })
  profitMargin: number;

  @Prop({ type: Number, required: false })
  baseIncentiveAllownace: number;

  @Prop({ type: Number, required: false })
  incentiveTotal: number;
}
export class RewardStreams {
  @Prop({ required: false, type: String, enum: Object.values(Actions) })
  action: Actions;

  @Prop({ type: Number, required: false })
  wheel: number;

  @Prop({ type: Number, required: false })
  wallet: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  actionFrom: string;
}
export class Segmentations {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Segment.name,
    required: false,
  })
  segment: string;

  @Prop({ type: Number, required: false })
  value: number;
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
export class Incentive {
  id?: string;

  @Prop()
  baseInsentive: BaseIncentive;

  @Prop()
  rewardStreams: RewardStreams[];

  @Prop()
  segmentation: Segmentations[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: false,
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: false,
  })
  product: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: PriceList.name,
    required: true,
  })
  priceList: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  userType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;

  @Prop({ type: Boolean, required: false })
  rabehIncentiveToEnergyaProduct: boolean;
}

const IncentiveSchema = SchemaFactory.createForClass(Incentive);
IncentiveSchema.index({
  vertical: 1,
  supplier: 1,
  userType: 1,
  productType: 1,
}); //compound index

export { IncentiveSchema };
