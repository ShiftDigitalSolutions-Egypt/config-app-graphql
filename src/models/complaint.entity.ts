import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { District } from './district.entity';
import { Governorate } from './governorate.entity';
import { Supplier } from './supplier.entity';
import { User } from './_user.model';
import { Vertical } from './vertical.entity';

export type ComplaintDocument = Complaint & Document;

export enum StatusEnum {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  CLOSED = 'closed',
}
export enum ComplaintTypeEnum {
  COMPLAINT = 'complaint',
  SUGGESTION = 'suggestion',
  INQUIRY = 'inquiry',
}

export interface ExtendedGovernorate {
  id: string;
  name: string;
}
export interface ExtendedDistrict {
  id: string;
  name: string;
}
export interface ExtendedAnonymousUser {
  firstName: string;
  lastName: string;
  phone: string;
}
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
export class Complaint {
  @Prop({ type: Number, required: true, unique: true })
  id: number;
  @Prop({ type: String, enum: ComplaintTypeEnum, required: true })
  type: string;
  @Prop({ type: String, required: true })
  title: string;
  @Prop({ type: String, required: true })
  description: string;
  @Prop({ type: String })
  image: string;
  @Prop({ enum: StatusEnum, default: 'pending' })
  status: StatusEnum;
  @Prop({ type: String })
  feedback: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Supplier.name, required: true })
  supplier: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Vertical.name, required: true })
  vertical: string;

  @Prop(
    raw({
      id: { type: MongooseSchema.Types.ObjectId, ref: Governorate.name },
      name: {
        type: String,
        required: function () {
          if (this.type != ComplaintTypeEnum.INQUIRY && !this.firebaseUserId) return true;
        },
      },
    }),
  )
  governorate: ExtendedGovernorate;

  @Prop(
    raw({
      id: { type: MongooseSchema.Types.ObjectId, ref: District.name },
      name: {
        type: String,
        required: function () {
          if (this.type != ComplaintTypeEnum.INQUIRY && !this.firebaseUserId) return true;
        },
      },
    }),
  )
  district: ExtendedDistrict;

  @Prop(
    raw({
      firstName: { type: String },
      lastName: { type: String },
      phone: { type: String },
    }),
  )
  anonymousUser?: ExtendedAnonymousUser;

  @Prop({ type: String, required: false })
  name: string;  


  @Prop({ type: String, required: false })
  phone: string;  

  @Prop({ type: [String], required: false })
  images: string[];

  @Prop({ type: String, required: false })
  firebaseUserId: string;

  @Prop({type: String,required: false})
    qrCode: string;

    @Prop({type: String,required: false})
  qrStatus:string;
}
export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
