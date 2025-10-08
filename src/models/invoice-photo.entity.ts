import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './_user.model';

export type InvoicePhotoDocument = InvoicePhoto & Document;
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
export class InvoicePhoto {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: string;
  @Prop({ type: [String], required: true })
  images: string[];
}
export const InvoicePhotoSchema = SchemaFactory.createForClass(InvoicePhoto);
