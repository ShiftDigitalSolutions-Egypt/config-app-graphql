import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserType, UserTypeDocument } from './user-type.entity';
import { Vertical } from './vertical.entity';
export enum SubjectType {
  USERS = 'users',
  WALLETTRANSACTIONS = 'wallettransactions',
  ENDOFMONTHLOGS = 'endofmonths',
  CLIENTREQUEST = 'clientrequests',
  COMPLAINTS = 'complaints',
}
export enum NotificationsMethods {
  All = 'ALL',
  CUSTOMIZED = 'CUSTOMIZED',
  EXCELL = 'EXCELL',
}

export enum NotificationHistoryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
}

export interface userTypeExtended {
  name: string;
  id: string;
}
export type NotificationHistoryDocument = NotificationHistory & Document;

@Schema({ timestamps: true })
export class NotificationHistory {
  @Prop({ type: String, required: true })
  titleEn: string;

  @Prop({ type: String, required: true })
  titleAr: string;


  @Prop({ type: String, required: true })
  bodyEn: string;

  @Prop({ type: String, required: true })
  bodyAr: string;

  @Prop({ type: String, required: false, default: 'goruped-notification' })
  tag: string;


  @Prop({ type: String, required: false })
  previewUsersLink?: string;


  @Prop({ type: String, required: false })
  uploadedUsersLink?: string;


  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop(
    raw([{
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
    }]),
  )
  userTypes?: userTypeExtended[];

  @Prop({ required: true, type: String, enum: Object.values(NotificationsMethods) })
  method?: NotificationsMethods;

  @Prop({ required: false, type: String, enum: Object.values(NotificationHistoryStatus), default: NotificationHistoryStatus.PENDING })
  status?: NotificationHistoryStatus;
  @Prop({ type: Number, required: false, default: 0 })
  resendCounter?: number;

}

export const NotificationHistorySchema = SchemaFactory.createForClass(NotificationHistory);
/* 
NotificationSchema.methods.toFirebaseNotification = function () {
  return {
    notification: {
      title: this.title,
      body: this.body,
    },
  };
};
 */
