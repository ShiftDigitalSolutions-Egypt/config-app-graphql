import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type RegionDocument = Region & Document;
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
export class Region {
  id?: string;

  @Prop({ type: String })
  name: string;
}

const RegionSchema = SchemaFactory.createForClass(Region);

export { RegionSchema };
