import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Vertical } from './vertical.entity';
import { ProductType } from './product-type.entity';
import { ProductTypeStatus } from '../enums/productTypeStatus';

export interface VerticalType {
  vertical: string;
  jsonVersion: number;
  syncData: boolean;
}

export type SupplierDocument = Supplier & Document;

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
export class Supplier {
  id?: string;

  @Prop({ type: String, index: 'text' })
  name: string;

  @Prop({ type: String, required: false })
  alternativeName?: string;

  @Prop(
    raw([
      {
        _id: false,
        vertical: {
          type: MongooseSchema.Types.ObjectId,
          ref: Vertical.name,
          required: false,
        },
        jsonVersion: {
          type: Number,
          default: 1,
        },

        syncData: {
          type: Boolean,
          default: false,
        },
      },
    ]),
  )
  verticals: VerticalType[];

  @Prop(
    raw([
      {
        _id: false,
        productTypeId: {
          type: MongooseSchema.Types.ObjectId,
          ref: ProductType.name,
          required: true,
        },
        status: {
          type: String,
          enum: Object.values(ProductTypeStatus),
          default: ProductTypeStatus.ENABLE,
        },
      },
    ]),
  )
  productTypes: string[];

  @Prop({ type: String })
  imageUrl?: string;
}

const SupplierSchema = SchemaFactory.createForClass(Supplier);

export { SupplierSchema };
