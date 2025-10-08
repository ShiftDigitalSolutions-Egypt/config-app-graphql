import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Property } from './property.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { ProductType } from './product-type.entity';

export type SupplierPathDocument = SupplierPath & Document;

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
export class SupplierPath {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
    // autopopulate: true,
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
    index: true,
    // autopopulate: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: true,
    // autopopulate: true,
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Property.name,
    required: true,
    // autopopulate: true,
  })
  property: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: true,
    // autopopulate: true,
  })
  value: string;

  @Prop({
    type: Number,
    required: false,
  })
  level: number;
}

const SupplierPathSchema = SchemaFactory.createForClass(SupplierPath);

export { SupplierPathSchema };
