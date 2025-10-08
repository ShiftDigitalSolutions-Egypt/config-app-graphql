import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  UpdateUsersSegmentsFileNameEnum,
  UpdateUsersSegmentsMethodEnum,
  UpdateUsersSegmentsStatusEnum,
} from '../enums/segments-mangment.enum';
import mongoose, { Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { SupplierExtended, UserTypeInterFace } from './_user.model';
import { UserType } from './user-type.entity';

export type SegmentsMangmentDocument = SegmentsMangment & Document;

@Schema({
  timestamps: true,
})
export class SegmentsMangment {
  @Prop({ type: String, enum: Object.values(UpdateUsersSegmentsFileNameEnum), required: false })
  fileName: string;

  @Prop({ type: String, enum: Object.values(UpdateUsersSegmentsMethodEnum), required: true })
  method: string;

  @Prop({ type: String, required: true })
  uploadedFileLink: string;

  @Prop({ type: String, enum: Object.values(UpdateUsersSegmentsStatusEnum), required: true })
  status: UpdateUsersSegmentsStatusEnum;

  @Prop({ type: String, required: false })
  previewFileLink: string;

  @Prop({ type: Number, required: false })
  totalUsers: number;

  @Prop({ type: Number, required: false })
  updatedUsers: number;

  @Prop({ type: Number, required: false })
  scheduledUsers: number;

  @Prop({ type: Number, required: false })
  invalidEntries: number;

  @Prop({ type: Date, required: false })
  scheduledAt: Date;

  @Prop({ type: String, required: false })
  supplierId?: string;

  @Prop({
    type: [
      raw({
        _id: false,
        id: {
          type: mongoose.Types.ObjectId,
          ref: UserType.name,
          required: false,
        },
        name: {
          type: String,
          required: false,
        },
      }),
    ],
  })
  usersTypes?: UserTypeInterFace[];
}

export const SegmentsMangmentSchema = SchemaFactory.createForClass(SegmentsMangment);
