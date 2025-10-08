import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';

export type AdsBannerDocument = AdsBanner & Document;
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
export class AdsBanner {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string;
  @Prop({ type: Date, required: true })
  startDate: Date;
  @Prop({ type: Date, required: true })
  endDate: Date;
  @Prop({ type: [String], required: true })
  image: string[];
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;
}
export const AdsBannerSchema = SchemaFactory.createForClass(AdsBanner);
