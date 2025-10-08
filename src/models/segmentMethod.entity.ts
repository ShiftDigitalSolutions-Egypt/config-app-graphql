import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Segment } from './segment.entity';
import { MethodType } from './_end-of-month.entity';

export type SegmentMethodDocument = SegmentMethod & Document;
export interface SegmentObj {
  id: string;
  name: string;
}

export interface Segments {
  segment: SegmentObj;
  value: number;
}
@Schema()
export class SegmentMethod {
  method?: MethodType;

  @Prop(
    raw([
      {
        _id: false,
        segment: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: Segment.name,
            required: true,
          },
          name: { type: String },
        },
        value: { type: Number, required: true },
      },
    ]),
  )
  segments: Segments[];
}

const SegmentMethodMethodSchema = SchemaFactory.createForClass(SegmentMethod);

export { SegmentMethodMethodSchema };
