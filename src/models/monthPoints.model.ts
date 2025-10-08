import { Prop, Schema, SchemaFactory, DiscriminatorOptions, raw } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { User } from './_user.model';
import moment from 'moment';

export type MonthPointsDocument = MonthPoints & Document;

export function currentMonth(): number {
  const currentMonth = moment().month() + 1;
  return currentMonth;
}

export function currentYear(): number {
  const currentYear = moment().year();
  return currentYear;
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
export class MonthPoints {
  id?: string;

  @Prop({ type: MongooseSchema.ObjectId, ref: User.name, required: true })
  user: string;

  @Prop({ type: Number, default: 0 })
  totalPoints: number;

  @Prop({ type: Number, default: 0 })
  wheelPoints: number;

  @Prop({ type: Number, required: true, min: 1, max: 12 })
  month: number;

  @Prop({ type: Number, required: true })
  year: number;

  @Prop({ type: Number, default: 1 })
  incKey?: number;

  @Prop({ type: Number, default: 0 })
  scanCounter?: number;
}

const MonthPointsSchema = SchemaFactory.createForClass(MonthPoints);

MonthPointsSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

export { MonthPointsSchema };
