import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Batchgeneration } from './batchgeneration.entity';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { PropertyValue } from './property-value.entity';
import { Property } from './property.entity';
import { QrCode } from './qr-code.entity';
import { Unit } from './unit.entity';
import { UserType } from './user-type.entity';
import { User } from './_user.model';
import { Warehouse } from './warehouse.entity';

export type WarehouseStockDocument = WarehouseStock & Document;

export interface ExtendedWareHouse {
  id: string;

  name: string;
}

export interface ExtendedProductType {
  id: string;

  name: string;
}

export interface ExtendedSupplier {
  id: string;

  name: string;
}

export interface ExtendedVertical {
  id: string;

  name: string;
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
      };
      unit: {
        _id: string;
        name: string;
      };
    },
  ];
  name: string;
  image: string;
}

@Schema({
  // plugin(autoIncrement.plugin, 'Book'),
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
export class WarehouseStock {
  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: Number, required: false })
  purchase: number;

  @Prop({ type: Number, required: false })
  sells: number;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: ProductType.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  productType: ExtendedProductType;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  vertical: ExtendedVertical;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  supplier: ExtendedSupplier;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId, //  wareHouse
        ref: Warehouse.name,
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    }),
  )
  wareHouse: ExtendedWareHouse;

  @Prop(
    raw({
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
          },
          unit: {
            _id: {
              type: MongooseSchema.Types.ObjectId,
              ref: Unit.name, ///EDDITON
              required: false,
            },
            name: { type: String },
          },
        },
      ],

      name: { type: String },
      image: { type: String },
    }),
  )
  product: ExtendedProduct;
}
const WarehouseStockSchema = SchemaFactory.createForClass(WarehouseStock);
export { WarehouseStockSchema };
