import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { UserDocument } from './_user.model';

export enum SubjectType {
  USERS = 'users',
  WALLETTRANSACTIONS = 'wallettransactions',
  ENDOFMONTHLOGS = 'endofmonths',
  CLIENTREQUEST = 'clientrequests',
  COMPLAINTS = 'complaints',
  REPORT = 'Report',
  MILESTONE = 'tracks',
  REWARD = 'reward',
  REFERING = 'refering',
  PRICE_LIST = 'PriceList',
  MARKET_PLACE_ORDER = 'MarketPlaceOrder',
  EVOUCHERS = 'evouchers',
  HOLD_INVENTIVE_LOGS = 'holdIncentiveLogs',
}

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: String, required: true })
  titleEn: string;

  @Prop({ type: String, required: true })
  titleAr: string;

  @Prop({ type: String, required: true })
  bodyEn: string;

  @Prop({ type: String, required: true })
  bodyAr: string;

  @Prop({
    type: String,
    default: 'https://filesupload.fra1.digitaloceanspaces.com/Hse-Files/images/Frame%201261156920%20%282%29.png',
  })
  icon?: string;

  @Prop({
    type: String,
    default: 'https://filesupload.fra1.digitaloceanspaces.com/Hse-Files/images/Frame%201261156920%20%282%29.png',
  })
  readIcon?: string;

  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'users',
      },
    ],
  })
  targetUsers?: (string | UserDocument)[];

  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: 'users',
      },
    ],
  })
  readBy?: (string | UserDocument)[];

  @Prop({ type: Boolean, default: true })
  hasActions: boolean;

  @Prop({ required: true, type: String, enum: Object.values(SubjectType) })
  subjectType?: SubjectType;

  @Prop({ type: MongooseSchema.Types.ObjectId, refPath: 'subjectType', required: true /*autopopulate: true */ })
  subject?: string | ObjectId;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
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
