import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Supplier } from './supplier.entity';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReportDocument = Report & Document;

export enum StatusEnum {
  OPEN = 'open',
  IN_REVIEW = 'in-review',
  CLOSED = 'closed',
}

@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      //prevent this fields from returning in a response
      delete doc.__v;
      delete doc._id;
      return {
        ...doc,
      };
    },
  },
})
export class Report {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string;

  @Prop({ type: String, required: false })
  appName: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: false })
  UserId: string;

  @Prop({ type: String, required: true })
  phone: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ enum: StatusEnum, default: 'open' })
  status: StatusEnum;

  @Prop({ type: String, required: false })
  qrCode: string;

  @Prop({ type: String, required: false })
  qrStatus: string;

  @Prop({ type: String })
  feedback: string;

  @Prop({ type: Number, required: true, unique: true })
  reportId: number;
}
export const ReportSchema = SchemaFactory.createForClass(Report);
