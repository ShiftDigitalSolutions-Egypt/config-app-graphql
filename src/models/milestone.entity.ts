import {
  Prop,
  Schema,
  SchemaFactory,
  DiscriminatorOptions,
  raw,
} from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Gift, GiftDocument } from './gift.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { Segment } from './segment.entity';
import { Supplier } from './supplier.entity';
import { TrackType, UserTrack } from './track-type.entity';
import { UserType } from './user-type.entity';
import { UserRole } from './_user.model';
import { Vertical } from './vertical.entity';
import { Wheel } from './wheel.entity';




export type TrackDocument = Track & Document;


export interface UsersType {

  userType: {
    id: string,
    name: string
  }

  segments: [{
    id: string;
    name: string;

  }]
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
export class Track {

  id?: string;

  @Prop({ type: String })
  name: string;

  @Prop(
    raw(
      {
        _id: false,
        userType: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: UserType.name,
            required: false,
            // autopopulate: true,
          },
          name: String

        },

        segments: [
          {
            _id: false,
            id: {
              type: MongooseSchema.Types.ObjectId,
              ref: Segment.name,
              required: false,
            },
            name: String
          },
        ],
      },
    ),
  )
  usersType: UsersType;

  @Prop({ type: Number, required: true })
  milestonesLength: number;


  @Prop({ default: false, type: Boolean })
  isDefault: boolean;

  @Prop({ default: 0, type: Number })
  numberOfUsers: number;


  @Prop(
    raw([
      {
        _id: false,
        wheel: {
          type: MongooseSchema.Types.ObjectId,
          ref: Wheel.name,
          required: true,
        },
        value: { type: Number, default: 0 },
      },
    ]),
  )
  milestones: Record<string, any>[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
    index: true,
  })
  supplier: string;


}

const MilestoneSchema = SchemaFactory.createForClass(Track);



export { MilestoneSchema };





/*

{
  "name": "string",
   "vertical": "string",
  "supplier": "string",
  "usersType": [
    {
      "userType": "63d0fa5b36349c3a684d4712",
      "segments": [
        "63c81fc6681807798957a82d"
      ]
    },
{
      "userType": "63d0fa5b36349c3a684d4713",
      "segments": [
        "63c81fc6681807798957a82c"
      ]
    }
  ],
  "isDefault": true,
  "milestones": [
    {
      "wheel": "63548f11727a4b24ba09614c",
      "value":10
    },
{
      "wheel": "63548f5b727a4b24ba096152",
      "value": 20
    },
{
      "wheel": "63548fd0727a4b24ba09615a",
      "value": 50
    }

  ]
}

*/