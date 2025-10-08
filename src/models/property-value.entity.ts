import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Property } from './property.entity';
import { Unit } from './unit.entity';

export type PropertyValueDocument = PropertyValue & Document;

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
export class PropertyValue {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Property.name,
    required: true,
    // autopopulate: true,
  })
  property: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Unit.name,
    required: false,
    // autopopulate: true,
  })
  unit: string;
}

const PropertyValueSchema = SchemaFactory.createForClass(PropertyValue);

export { PropertyValueSchema };
