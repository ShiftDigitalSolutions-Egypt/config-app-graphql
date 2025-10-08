import { Schema as MongooseSchema, Document } from 'mongoose';
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { User } from './_user.model';
import { ScanAction } from './scan.entity';

export type BackWordLogDocument = BackWordLog & Document;

export interface BackWordUser {
  id: string;
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
export class BackWordLog {
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    }),
  )
  backwordingUser: BackWordUser;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: true,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    }),
  )
  backwordedUser: BackWordUser;

  @Prop({ type: Number, required: true })
  points: number;

  @Prop({ type: String, required: true })
  scanActions: ScanAction;

  @Prop({ type: String, required: true })
  qrCode: string;
}

const BackwordLogsSchema = SchemaFactory.createForClass(BackWordLog);

export { BackwordLogsSchema };
