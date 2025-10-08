import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PropertyDocument = Property & Document;

export enum PropertyType {
  LIST = 'LIST',
  TEXT = 'TEXT',
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
export class Property {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(PropertyType),
    default: PropertyType.LIST,
  })
  type: PropertyType;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
