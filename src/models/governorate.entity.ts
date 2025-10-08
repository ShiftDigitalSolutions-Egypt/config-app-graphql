import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type GovernorateDocument = Governorate & Document;
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
export class Governorate {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  country: string
}

const GovernorateSchema = SchemaFactory.createForClass(Governorate);

export { GovernorateSchema };
