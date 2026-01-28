import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ObjectType, Field } from '@nestjs/graphql';
import { ProductType } from './product-type.entity';
import { Property } from './property.entity';
import { PropertyValue } from './property-value.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { UnitMeasurement } from './unit-measurement.entity';

export type ProductDocument = Product & Document;

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
@ObjectType()
export class Product {
  @Field({ nullable: true })
  id?: string;

  @Field()
  @Prop({ type: String })
  name: string;

  @Field()
  @Prop({ type: String })
  code: string;

  @Prop({ type: Number })
  price: number;

  @Prop({ type: Boolean, default: true, required: false })
  enabled: boolean;

  @Prop({ type: Number, required: false })
  discountRatio: number;

  @Prop({ type: Number, required: false, default: 0 })
  priceAfterDiscount: number;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String })
  image: string;

  @Prop({ type: String })
  link: string;

  @Prop({ type: Number })
  numberOfPacking: number;

  @Prop({ type: Number })
  numberOfPallet: number;

  @Prop({ type: Boolean })
  patchId: boolean;

  @Prop({ type: Boolean })
  productionDate: boolean;

  @Prop({ type: Number })
  expirationDate: number;

  @Prop({ type: Boolean })
  enableToPacking: boolean;

  @Prop({ type: Boolean })
  orderNumber: boolean;

  @Prop({ type: Boolean })
  palletGuided: boolean;

  @Prop({ type: Boolean })
  enableToPallet: boolean;

  @Prop({ type: Boolean })
  palletAssembly: boolean;

  // aggrigation delivery note by measurement
  @Prop({ type: Boolean })
  quantityAggregationMeasurement: boolean;

  // aggrigation by another measurement
  @Prop({ type: Boolean, default: false })
  aggregatedByAnotherMeasurement: boolean;

  // number of measurement unite per product
  @Prop({ type: Number })
  numberOfMeasurement: number;

  // aggrigation by another measurement unit
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UnitMeasurement.name,
    required: false,
    default: null
  })
  aggregatedByMeasurementUnit: string;

  // unit measurement per product
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UnitMeasurement.name,
    required: true,
  })
  unitMeasurement: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ProductType.name,
    required: true,
  })
  productType: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;

  @Prop(
    raw([
      {
        _id: false,
        key: {
          type: MongooseSchema.Types.ObjectId,
          ref: Property.name,
          required: true,
        },
        value: {
          type: MongooseSchema.Types.ObjectId,
          ref: PropertyValue.name, ///EDDITON
          required: true,
        },
      },
    ]),
  )
  values: Record<string, any>[];

  
  @Prop({ type: Boolean, default: false, required: false })
  enabledChatbot: boolean;

  @Prop({ type: String, required: false })
  productChatbotLink: string;

  @Prop(
    raw({
      suggestedQuestionsAr: { type: [String], default: [] },
      suggestedQuestionsEn: { type: [String], default: [] },
      knowledgeBaseFileUrl: { type: String, required: false },
      knowledgeBaseFileName: { type: String, required: false },
      pineconeNamespace: { type: String, required: false },
      lastUpdated: { type: Date, required: false },
      vectorCount: { type: Number, default: 0 },
    }),
  )
  chatbotConfig?: {
    suggestedQuestionsAr: string[];
    suggestedQuestionsEn: string[];
    knowledgeBaseFileUrl?: string;
    knowledgeBaseFileName?: string;
    pineconeNamespace?: string;
    lastUpdated?: Date;
    vectorCount?: number;
  };

  @Prop({ type: Boolean })
  enableUnitPerPallet: boolean;

  @Prop({ type: Number })
  numberOfUnitPerPallet: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
