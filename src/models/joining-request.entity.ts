import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { UserType, UserTypeDocument } from './user-type.entity';
import { SupplierExtended, User, UserDocument, UserRole } from './_user.model';
import { Constants } from '../utils/constants';
import { Supplier } from './supplier.entity';
import { Segment, SegmentDocument } from './segment.entity';

export type JoiningRequestDocument = JoiningRequest & Document;

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
export class JoiningRequest {
  id?: string;

  @Prop({
    get: (firstName: string) => {
      return firstName.toUpperCase();
    },
    set: (firstName: string) => {
      return firstName.trim();
    },
    required: true,
  })
  firstName: string;

  @Prop({
    get: (lastName: string) => {
      return lastName.toUpperCase();
    },
    set: (lastName: string) => {
      return lastName.trim();
    },
    required: true,
  })
  lastName: string;

  @Prop({
    index: true,
    //unique: true,
    match: Constants.PHONE_REGX,
  })
  phone: string;


  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  originalBalance: number;

  @Prop({ default: false, type: Boolean }) // todo using  in joining request
  enabled: boolean;

  @Prop({ default: false, type: Boolean, required: false }) // todo using  in joining request
  isBlocked: boolean;

  // this for susbend user
  @Prop({ default: false, type: Boolean, required: false }) // todo using for soft delete  user or change account reuest
  isRequestedToChange: boolean;

  @Prop({ default: false, type: Boolean }) // todo using  in joining request
  isRewarded: boolean;

  @Prop({
    type: String,
    required: false,
    default: undefined
  })
  whyRejected: string;//
  @Prop({
    type: String,
    required: false,
  })
  comment: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string | UserTypeDocument;//

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Governorate.name,
    required: true,
  })
  governorate: string | GovernorateDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: District.name,
    required: true,
  })
  district: string | DistrictDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Segment.name,
    required: false,
  })
  segment: string | SegmentDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // default: null,
    // required: true,
  })
  referal?: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // default: null,
    // required: true,
  })
  acceptedBy?: string | UserDocument;

  @Prop({ type: Date, required: false })
  acceptedAt: Date;

  @Prop({ default: false, type: Boolean })
  isRefered?: boolean;

  @Prop({ type: Boolean, default: true })
  referralStatus: boolean;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: Supplier.name,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  supplier?: SupplierExtended;
}
const JoiningRequestSchema = SchemaFactory.createForClass(JoiningRequest);
// Adding the partial unique index to the schema
JoiningRequestSchema.index(
  { phone: 1, 'supplier.name': 1 }, // Fields to index
  {
    unique: true,
    partialFilterExpression: { isRequestedToChange: false }, // Condition for partial index
  }
);
export { JoiningRequestSchema };
