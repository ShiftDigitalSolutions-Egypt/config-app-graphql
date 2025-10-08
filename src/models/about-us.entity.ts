import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Supplier } from './supplier.entity';

export type AboutUsDocument = AboutUs & Document;
@Schema()
export class Social {
  @Prop({ required: false })
  name: string;

  @Prop({ required: false })
  link: string;
}
export const SocialSchema = SchemaFactory.createForClass(Social);

@Schema()
export class FAQ {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;
}

export const FAQSchema = SchemaFactory.createForClass(FAQ);

@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      //prevent this fields from returning in a response
      delete doc.__v;
      return {
        ...doc,
      };
    },
  },
})
export class AboutUs {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
    unique: true,
  })
  supplierId: string;
  @Prop({ type: String, ref: Supplier.name, required: true })
  supplierName: string;

  @Prop({ type: String, required: true, maxlength: 350 })
  description: string;

  @Prop({ type: String, required: false })
  imageUrl: string; // URL for the uploaded image

  @Prop({ _id: false, type: [SocialSchema], required: false })
  socialLinks: Social[];

  @Prop({
    _id: false,
    type: [FAQSchema],
    required: false,
    validate: {
      validator: function (faqs: FAQ[]) {
        return faqs.length <= 20;
      },
      message: 'A maximum of 20 FAQs are allowed.',
    },
  })
  faqs: FAQ[];

  @Prop({ type: String, required: false })
  contactNumber: string;

  @Prop({ type: String, required: false })
  landline: string;

  @Prop({ type: String, required: false })
  hotline: string;
}

export const AboutUsSchema = SchemaFactory.createForClass(AboutUs);

// AboutUsSchema.index({ supplier: 1 }, { unique: true });
