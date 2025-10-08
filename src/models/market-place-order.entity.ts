import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import {
  UserType,
  UserTypeDocument,
} from './user-type.entity';
import { User, UserDocument } from './_user.model';
import { Constants } from '../utils/constants';
import { SupplierDocument } from './supplier.entity';
import { PropertyValue } from './property-value.entity';
import { Property } from './property.entity';
import { Product } from './product.entity';
import { CashbackStatusEnum } from '../enums/cashback-status.enum';
import { addressInfoObject } from './market-place-user-address.entity';

export enum OrderStatus {
  PLACED = 'PLACED',
  APPROVED = 'APPROVED',
  SHIPPED = 'SHIEPPED',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
}
export enum PaymentMethodEnum {
  CASH = 'cash',
  BANK_CARD = 'bankCard',
  INSTALLMENT = 'installment',
}
export interface ExtendedProduct {
  id: string;
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
  priceInfo: ExtendedPrice;
  name: string;
  code: string;
  image: string;
  quantity: number;
  productTotalPriceAfterVat: number;
  description: string;
  extraDiscount?: number;
  applyDiscount?: boolean;
}

export interface ExtendedPrice {
  productBasePrice: number;
  rate: number;
  productPriceAfterRate: number;

  basePriceAfterVat: number;
  vat: number;
  vatPrice: number;
  priceAfterVat: number;
}

export interface ExtendedOrderDates {
  status: OrderStatus;
  date: Date;
}

export interface cashbackObject {
  amount: number;
  cashbackStatus: CashbackStatusEnum;
  title: String;
  description: String;
  percentage: number;
  numberOfDays: number;
  idIncrement: number;
}
export type MarketPlaceOrderDocument = MarketPlaceOrder & Document;
@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      //prevent this fields from returning in a response
      delete doc.__v;
      delete doc._id;
      return {
        ...doc,
      };
    },
  },
})
export class MarketPlaceOrder {
  id?: string;

  @Prop({ type: Number, unique: true })
  orderId: number;

  @Prop({
    //index: true,
    //unique: true,
    required: false,
    match: Constants.PHONE_REGX,
  })
  phone: string;

  @Prop({ required: false, type: String, enum: Object.values(OrderStatus) })
  status?: OrderStatus;

  @Prop({ type: Date, required: false })
  statusDate: Date;

  @Prop(
    raw([
      {
        _id: false,
        id: {
          type: MongooseSchema.Types.ObjectId,
          ref: Product.name,
          required: false,
        },
        values: [
          {
            _id: false,
            key: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: Property.name, ///EDDITON
                required: false,
              },
              name: { type: String },
            },
            value: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: PropertyValue.name, ///EDDITON
                required: false,
              },
              name: { type: String },
              unit: {
                _id: {
                  type: MongooseSchema.Types.ObjectId,
                  ref: Property.name, ///EDDITON
                  required: false,
                },
                name: { type: String },
              },
            },
          },
        ],
        priceInfo: {
          productBasePrice: { type: Number, required: true },
          rate: { type: Number, required: true },
          productPriceAfterRate: { type: Number, required: true },
          basePriceAfterVat: { type: Number, required: true },
          vat: { type: Number, required: true },
          vatPrice: { type: Number, required: true },
          priceAfterVat: { type: Number, required: true },
        },
        name: { type: String },
        image: { type: String, required: false },
        code: { type: String, required: false },
        quantity: { type: Number, required: false },
        productTotalPriceAfterVat: { type: Number, required: false },
        description: { type: String, required: false },
        extraDiscount: { type: Number, required: false, default: 0 },
        applyDiscount: { type: Boolean, required: false, default: true },
      },
    ]),
  )
  products: ExtendedProduct[];

  @Prop(
    raw([
      {
        _id: false,
        date: { type: Date, required: false },
        status: { type: String, enum: Object.values(OrderStatus) },
      },
    ]),
  )
  orderDates: ExtendedOrderDates[];
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  supplier?: string | SupplierDocument;

  @Prop(
    raw({
      isDefault: { type: Boolean, default: false },
      label: {
        type: String,
        required: true,
      },
      description: { type: String, required: false },
      deliveryAddress: { type: String, required: true },
      location: {
        coordinates: {
          type: Array,
          required: true,
        },
        type: {
          type: String,
          enum: ['Point'],
          default: function () {
            if (
              this.location?.coordinates?.legnth !== 0 &&
              this.location?.coordinates !== undefined
            ) {
              return 'Point';
            }
          },
        },
      },
      personName: {
        type: String,
        required: true,
      },
      personPhoneNumber: {
        type: String,
        match: /^(?:(?:\+|00)20)0?(10|11|12|15|16|17|18|19)[0-9]{8}$/,
        required: true,
      },
    }),
  )
  address: addressInfoObject;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  userType: string | UserTypeDocument;

  // @Prop({ required: false })
  // coordinates: number[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // default: null,
    // required: true,
  })
  user: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // default: null,
    required: false,
  })
  acceptedBy?: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // default: null,
    required: false,
  })
  rejectedBy?: string | UserDocument;

  @Prop({
    type: String,
    required: false,
    default: undefined,
  })
  whyRejected: string; //

  @Prop({
    type: String,
    required: false,
  })
  note: string;

  @Prop({
    type: Number,
    required: false,
  })
  totalOrderBasePrice: number;

  @Prop({
    type: Number,
    required: false,
  })
  totalOrderVariancePrice: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  totalNewDiscount: number;

  @Prop({
    type: Number,
    required: true,
  })
  totalOrderPriceAfterRate: number;

  @Prop({
    type: Number,
    required: true,
  })
  vat: number;

  @Prop({
    type: Number,
    required: true,
  })
  finalOrderPriceAfterVat: number;

  @Prop({
    type: Number,
    required: false,
  })
  requestedPrice: number;

  @Prop({
    type: String,
    default: PaymentMethodEnum.CASH,
    enum: PaymentMethodEnum,
  })
  paymentMethod: PaymentMethodEnum;

  @Prop({ default: false, type: Boolean, required: false }) // todo using  in soft delete   Order
  deleted: boolean;

  @Prop({ type: Boolean, default: false })
  isWalletUsed: boolean;
  @Prop({ type: Number, default: 0 })
  deductedWalletAmount: number;
  @Prop({ type: Number, default: 0 })
  maxWalletDeductionAmount: number;
  @Prop({ type: Number, default: 0 })
  percentageDeductedFromWallet: number;
  @Prop({ type: Boolean, default: false })
  hasCashback: boolean;
  @Prop({ type: Number, default: 0 })
  cashbackAmount: number;
  @Prop(
    raw({
      amount: { type: Number },
      cashbackStatus: { type: String, enum: CashbackStatusEnum },
      title: { type: String },
      description: { type: String },
      percentage: { type: Number },
      numberOfDays: { type: Number },
      idIncrement: { type: Number },
    }),
  )
  cashbackObject: cashbackObject;
}
const MarketPlaceOrderSchema = SchemaFactory.createForClass(MarketPlaceOrder);
export { MarketPlaceOrderSchema };
