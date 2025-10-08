import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Vertical } from './vertical.entity';

export type ProductTypeDocument = ProductType & Document;

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
export class ProductType {
  id?: string;

  @Prop({ type: String, unique: true })
  name: string;

  @Prop({ type: String, required: true })
  imgUrl: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;
}

export const ProductTypeSchema = SchemaFactory.createForClass(ProductType);
