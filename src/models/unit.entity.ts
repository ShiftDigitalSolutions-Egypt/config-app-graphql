import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UnitDocument = Unit & Document;

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
export class Unit {
  id?: string;

  @Prop({ type: String })
  name: string;
}

const UnitSchema = SchemaFactory.createForClass(Unit);

export { UnitSchema };
