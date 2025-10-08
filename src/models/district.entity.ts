import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { Governorate, GovernorateDocument } from './governorate.entity';

export type DistrictDocument = District & Document;

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
export class District {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Governorate.name,
    required: true,
  })
  governorate: string | GovernorateDocument;
}

const DistrictSchema = SchemaFactory.createForClass(District);

export { DistrictSchema };
