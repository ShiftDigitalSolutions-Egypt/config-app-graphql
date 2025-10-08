// export class Warehouse {}
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { Segment } from './segment.entity';
import { Governorate } from './governorate.entity';
import { District } from './district.entity';
import { User } from './_user.model';

export interface Segments {
  segment: string;
  isDefault: boolean;
}

export interface verticalType {
  vertical: string;
  jsonVersion: number;
  syncData: boolean;
}

export interface Region {
  governorate: string;
  districts: string;
}

export interface Worker {
  user: string;
  enabled: boolean;
}

export enum WalletType {
  POINTS = 'POINTS',
  CASH = 'CASH',
}

export enum WareHouseUsers {
  SUPERVISOR = 'SUPERVISOR',
  WORKER = 'WORKER',
}

export enum Actions {
  BLOCKED = 'BLOCKED',
  ENABLED = 'ENABLED',
}

export type WarehouseDocument = Warehouse & Document;

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
export class Warehouse {
  id?: string;

  @Prop({ type: String })
  name: string;
  @Prop(
    raw([
      {
        _id: false,
        governorate: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: Governorate.name,
            required: false,
          },
          name: { type: String },
        },
        districts: [
          {
            id: {
              type: MongooseSchema.Types.ObjectId,
              ref: District.name,
              required: false,
              // autopopulate: true,
            },
            name: { type: String },
          },
        ],
      },
    ]),
  )
  region: Region[];

  // @Prop(
  //     raw([
  //         {
  //             _id: false,
  //             governorate: {
  //                 type: MongooseSchema.Types.ObjectId,
  //                 ref: Governorate.name,
  //                 required: false,
  //             },
  //             districts: [
  //                 {
  //                     type: MongooseSchema.Types.ObjectId,
  //                     ref: District.name,
  //                     required: false,
  //                     // autopopulate: true,
  //                 },
  //             ]

  //         },
  //     ]),
  // )
  // region: Region[];

  // {
  //     _id: false,
  //     key: {
  //         id: {
  //             type: MongooseSchema.Types.ObjectId,
  //             ref: Property.name, ///EDDITON
  //             required: false,
  //         },
  //         name: { type: String },
  //     },
  //     value: {
  //         id: {
  //             type: MongooseSchema.Types.ObjectId,
  //             ref: PropertyValue.name, ///EDDITON
  //             required: false,
  //         },
  //         name: { type: String },
  //         unit: { type: String, required: false },
  //     },
  // },

  @Prop(
    raw([
      {
        _id: false,
        user: {
          type: MongooseSchema.Types.ObjectId,
          ref: User.name,
          required: false,
          index: true
        },
        enabled: {
          default: true,
          type: Boolean,
        },
      },
    ]),
  )
  workers: Worker[];

  @Prop(
    raw([
      {
        _id: false,
        user: {
          type: MongooseSchema.Types.ObjectId,
          ref: User.name,
          required: false,
          index: true
        },
        enabled: {
          default: true,
          type: Boolean,
        },
      },
    ]),
  )
  supervisor: Worker[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  owner: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: true,
  })
  vertical: string;

  @Prop({ type: Boolean, required: false })
  sessionLock: boolean;
}

const WarehouseSchema = SchemaFactory.createForClass(Warehouse);

export { WarehouseSchema };
