// export class Cartlog {}
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { UserType, UserTypeDocument } from './user-type.entity';
import { SupplierExtended, User, UserDocument, UserRole } from './_user.model';
import { Supplier, SupplierDocument } from './supplier.entity';
import { PropertyValue } from './property-value.entity';
import { Property } from './property.entity';
import { Product } from './product.entity';
import { MarketPlaceOrder } from './market-place-order.entity';

export enum CartStatus {
  PROCESSING = 'PROCESSING',
  REQUESTED = 'REQUESTED',
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
  name: string;
  code: string;
  image: string;
  quantity: number;
  price: string;
  description: string;
}

export interface ExtendedPrice {
  basePrice: number;
  rate: number;
  finalPrice: number;
}

export interface ExtendedOrderDates {
  status: CartStatus;
  date: Date;
}
export type CartlogDocument = Cartlog & Document;
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
export class Cartlog {
  id?: string;

  @Prop({ required: false, type: String, enum: Object.values(CartStatus) })
  status?: CartStatus;

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
        // priceInfo: {
        //     basePrice: { type: Number, required: true },
        //     rate: { type: Number, required: true },
        //     finalPrice: { type: Number, required: true }
        // },
        name: { type: String },
        image: { type: String, required: false },
        code: { type: String, required: false },
        quantity: { type: Number, required: false },
        description: { type: String, required: false },
      },
    ]),
  )
  products: ExtendedProduct[];

  @Prop(
    raw([
      {
        _id: false,
        date: { type: Date, required: false },
        status: { type: String, enum: Object.values(CartStatus) },
      },
    ]),
  )
  cartDates: ExtendedOrderDates[];
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  supplier?: string | SupplierDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  userType: string | UserTypeDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    index: true,
  })
  user?: string | UserDocument;

  // @Prop({
  //     type: MongooseSchema.Types.ObjectId,
  //     ref: User.name,
  //     // default: null,
  //     required: false,
  // })
  // acceptedBy?: string | UserDocument;

  // @Prop({
  //     type: Number,
  //     required: false,
  // })
  // total: number;

  // @Prop({
  //     type: Number,
  //     required: false,
  // })
  // totaldiscount: number;

  // @Prop({
  //     type: Number,
  //     required: false,
  // })
  // totalAfterdiscount: number;

  // @Prop({
  //     type: Number,
  //     required: false,
  // })
  // vat: number;

  // @Prop({
  //     type: Number,
  //     required: false,
  // })
  // finalPrice: number;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: Cartlog.name,
    required: false,
  })
  childrens: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Cartlog.name,
    required: false,
  })
  lastChiled: string;

  @Prop({ default: false, type: Boolean, required: false }) // todo using  in soft delete
  deleted: boolean;

  @Prop({ default: true, type: Boolean, required: false }) // todo using  to link with new version of cart
  lastVersion: boolean;

  @Prop({ default: true, type: Boolean, required: false }) // todo will be  used  retrieve user  cart
  currentCart: boolean;

  @Prop({ type: Number, required: false })
  version: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MarketPlaceOrder.name,
    required: false,
  })
  order: string;
  // @Prop({
  //   type: String,
  //   required: true,
  // })
  // address: string;
}
const CartlogSchema = SchemaFactory.createForClass(Cartlog);
export { CartlogSchema };
