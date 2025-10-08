import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';
import { User } from './_user.model';

export interface supplierObjectExtended {
  id: ObjectId;
  name: string;
}

export interface userTypeObjectExtended {
  id: ObjectId;
  name: string;
}

export interface addressInfoObject {
  isDefault: boolean;
  label: string;
  description?: string;
  deliveryAddress: string;
  location: {
    type?: string;
    coordinates: [number, number];
  };

  personName: string;
  personPhoneNumber: string;
  _id?: MongooseSchema.Types.ObjectId;
}

export type MarketPlaceUserAdressDocument = MarketPlaceUserAddress & Document;
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
export class MarketPlaceUserAddress {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: ObjectId;

  @Prop(
    raw({
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: Supplier.name,
        required: true,
      },
      name: { type: String, required: true },
    }),
  )
  supplier: supplierObjectExtended;
  @Prop(
    raw({
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: true,
      },
      name: { type: String, required: true },
    }),
  )
  userType: userTypeObjectExtended;
  @Prop(
    raw([
      {
        isDefault: { type: Boolean, default: false },
        label: {
          type: String,
          required: true,
        },
        description: { type: String, required: false },
        deliveryAddress: { type: String, required: true },
        location: {
          coordinates: {
            type: Array,
            required: true,
          },
          type: {
            type: String,
            enum: ['Point'],
            default: function () {
              if (
                this.location?.coordinates?.legnth !== 0 &&
                this.location?.coordinates !== undefined
              ) {
                return 'Point';
              }
            },
          },
        },
        personName: {
          type: String,
          required: true,
        },
        personPhoneNumber: {
          type: String,
          match: /^(?:(?:\+|00)20)0?(10|11|12|15|16|17|18|19)[0-9]{8}$/,
          required: true,
        },
      },
    ]),
  )
  savedAddresses: addressInfoObject[];
}
export const MarketPlaceUserAddressSchema = SchemaFactory.createForClass(
  MarketPlaceUserAddress,
);
