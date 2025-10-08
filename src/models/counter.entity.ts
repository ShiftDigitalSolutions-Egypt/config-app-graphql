import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CounterDocument = Counter & Document;

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
export class Counter {
  @Prop()
  entity: string;

  @Prop({ default: 0 })
  seq: number;
}

const CounterSchema = SchemaFactory.createForClass(Counter);

export { CounterSchema };
