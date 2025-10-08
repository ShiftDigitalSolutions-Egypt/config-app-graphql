import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

export type ContactUsDocument = ContactUs & Document;

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
export class ContactUs {
  id?: string;

  @Prop({ type: String })
  phoneNumber: string;
}

export const ContactUsSchema = SchemaFactory.createForClass(ContactUs);
