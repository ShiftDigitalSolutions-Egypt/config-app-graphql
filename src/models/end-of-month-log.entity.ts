import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Model, Schema as MongooseSchema } from 'mongoose';
import { EndOfMonth, EndOfMonthDocument } from './_end-of-month.entity';
import { Vertical, VerticalDocument } from './vertical.entity';
import { Supplier, SupplierDocument } from './supplier.entity';

export type EndOfMonthLogDocument = EndOfMonthLog & Document;

export interface ExtendUserInfo {
  user: number;
  points: number;
  value: number;
  name: string;
  district: string;
  governorate: string;
  phone: string;
}

@Schema({
  // plugin(autoIncrement.plugin, 'Book'),
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
export class EndOfMonthLog {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: EndOfMonth.name,
    required: true,
  })
  endOfMoth?: string | EndOfMonthDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical?: string | VerticalDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier?: string | SupplierDocument;

  @Prop(
    raw([
      {
        _id: false,
        user: {
          type: Number,
          required: false,
        },
        points: {
          type: Number,
          required: false,
        },
        value: {
          type: Number,
          required: false,
        },

        name: {
          type: String,
          required: false,
        },

        district: {
          type: String,
          required: false,
        },

        governorate: {
          type: String,
          required: false,
        },

        phone: {
          type: String,
          required: false,
        },
      },
    ]),
  )
  users?: ExtendUserInfo[];

  // firstName: 1,
  // lastName: 1,
  // district: "$district.name",
  // governorate: "$governorate.name",
  // phone: 1,
  // userId: 1,
  // points: { $ifNull: ["$points.totalScanedPoints", 0] },
  // value: { $ifNull: [endOfMonthDoc.value, 0] },
}
const EndOfMonthLogSchema = SchemaFactory.createForClass(EndOfMonthLog);
export { EndOfMonthLogSchema };
