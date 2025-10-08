import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';

export type SegmentDocument = Segment & Document;

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
export class Segment {
  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;
}

const SegmentSchema = SchemaFactory.createForClass(Segment);

export { SegmentSchema };
