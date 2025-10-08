import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier, SupplierDocument } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { Segment } from './segment.entity';
import { SupplierExtended } from './_user.model';
import { QrCodeTypeGenerator } from './qr-code.entity';

export interface ITransferCashTo {
  name: string;
  userTypeId: string;
}
export interface Segments {
  segment: string;
  isDefault: boolean;
}

export enum UserRoles {
  ADMINS = 'ADMINS',
  OPERATION = 'OPERATION',
  FIELDFORCE = 'FIELDFORCE',
  USERS = 'USERS',
}

export interface verticalType {
  vertical: string;
  jsonVersion: number;
  syncData: boolean;
}

export interface Reward {
  action: Actions;
  userType: string;
  qrType: QrCodeTypeGenerator | QrCodeType;
  affectedActions: Actions;
}

export enum WalletType {
  POINTS = 'POINTS',
  CASH = 'CASH',
}

export enum Actions {
  PURCHASE = 'PURCHASE',
  SELLS = 'SELLS',
  USE = 'USE',
  REWARD = 'REWARD',
}

export enum QrCodeType {
  INNER = 'INNER',
  OUTER = 'OUTER',
  ORDER = 'ORDER',
  PACKAGE = 'PACKAGE',
  PALLET = 'PALLET',
  QUANTIFIED = 'QUANTIFIED',
}

export type UserTypeDocument = UserType & Document;

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
export class UserType {
  @Prop({ type: String })
  name: string;

  @Prop({ type: Number, unique: true })
  level: number;

  @Prop(
    raw([
      {
        _id: false,
        segment: {
          type: MongooseSchema.Types.ObjectId,
          ref: Segment.name,
          required: false,
          // autopopulate: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ]),
  )
  segments: Segments[];

  @Prop(
    raw([
      {
        _id: false,
        action: {
          required: false,
          type: String,
          enum: Object.values(Actions),
        },
        userTypes: [
          {
            type: MongooseSchema.Types.ObjectId,
            ref: UserType.name,
            required: false,
            // autopopulate: true,
          },
        ],
        qrType: [
          {
            required: false,
            type: String,
            enum: Object.values(QrCodeType),
          },
        ],
        affectedActions: {
          required: false,
          type: String,
          enum: Object.values(Actions),
        },
      },
    ]),
  )
  reward: Reward[];

  @Prop({ required: false, type: String, enum: Object.values(WalletType) })
  walletType: WalletType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string | SupplierDocument | SupplierExtended;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;

  @Prop({ default: false, type: Boolean })
  isSubProfile?: boolean;

  @Prop({ default: false, type: Boolean })
  isPublic?: boolean;

  @Prop({ default: false, type: Boolean })
  isAutoJoin?: boolean;

  @Prop({ default: false, type: Boolean })
  isAffectedParent?: boolean;

  @Prop({
    type: Number,
    required: false,
  })
  parentProfile?: number;

  @Prop({ default: false, type: String, enum: Object.values(UserRoles) })
  userRole: UserRoles;

  @Prop(
    raw([
      {
        name: {
          required: true,
          type: String,
        },
        userTypeId: {
          type: MongooseSchema.Types.ObjectId,
          required: true,
          ref: UserType.name,
        },
      },
    ]),
  )
  transferCashTo: ITransferCashTo[];
}

const UserTypeSchema = SchemaFactory.createForClass(UserType);

export { UserTypeSchema };
