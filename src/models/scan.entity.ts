import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Product } from './product.entity';
import { PropertyValue } from './property-value.entity';
import { Property } from './property.entity';
import { QrCode } from './qr-code.entity';
import { QrCodeType, UserType, WalletType } from './user-type.entity';
import { User, UserRole } from './_user.model';

export type ScanDocument = Scan & Document;

export enum ScanAction {
  SCANIN = 'SCANIN',
  SCANOUT = 'SCANOUT',
  SCANUSE = 'SCANUSE',
  REWARD = 'REWARD',
  AUTHENTICATE= 'AUTHENTICATE',
  SCAN = 'SCAN'
}

export interface UserScanInterFace {
  id: string;
  firstName: string;
  lastName: string;
  totalmoney?: number;
}
export interface ExtendedQrCode {
  type: QrCodeType;
  id: string;
  value: string;
  referenceNumber: string;
}
export interface ExtendedWareHouse {
  id: string;
  name: string;
}
export interface ExtendedProductType {
  id: string;
  name: string;
}
export interface ExtendedSupplier {
  id: string;
  name: string;
}
export interface ExtendedVertical {
  id: string;
  name: string;
}
export interface UserTypeData {
  _id: ObjectId;
  id: string;
  name: string;
  level: number;
  isSubProfile: boolean;
  parentProfile: string;
  role: UserRole;
}
export interface ExtendedProduct {
  id: string;
  _id: string;
  values: [
    {
      key: {
        _id: string;
        name: string;
      };
      value: {
        _id: string;
        name: string;
        unit: string;
      };
    },
  ];
  name: string;
  image: string;
  code: string;
  counter: number;
  unitMeasurement: any;
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
export class Scan {
  @Prop({ type: Number, required: false })
  counter: number;
  @Prop({ type: Number, required: false })
  purchasePoints: number;
  @Prop({ type: Number, required: false })
  sellsPoints: number;
  @Prop({ type: Number, required: false })
  usePoints: number;

  @Prop({ type: Number, required: false, default: 0 })
  backwordPoints: number;

  @Prop({ type: Number, required: false, default: 0 })
  backwordMoney: number;

  @Prop({ type: Number, required: false, default: 0 })
  wheelPoints: number;
  @Prop({
    type: Number,
    required: false,
  })
  patchNumber: number;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
        index: true,
      },
      firstName: {
        type: String,
        required: false,
      },
      lastName: {
        type: String,
        required: false,
      },
    }),
  )
  scannedFor: UserScanInterFace;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
    }),
  )
  scannedBy: UserScanInterFace;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: ProductType.name,
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    }),
  )
  productType: ExtendedProductType;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  vertical: ExtendedVertical;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  supplier: ExtendedSupplier;
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    }),
  )
  warehouse: ExtendedWareHouse;
  @Prop(
    raw([
      {
        _id: false,
        id: {
          type: MongooseSchema.Types.ObjectId,
          ref: Product.name,
          required: false,
        },
        values: [
          {
            _id: false,
            key: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: Property.name, ///EDDITON
                required: false,
              },
              name: { type: String },
            },
            value: {
              _id: {
                type: MongooseSchema.Types.ObjectId,
                ref: PropertyValue.name, ///EDDITON
                required: false,
              },
              name: { type: String },
              unit: { type: String, required: false },
            },
          },
        ],
        name: { type: String },
        image: { type: String, required: false },
        counter: { type: Number, required: false },
      },
    ]),
  )
  products: ExtendedProduct[];
  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: "QrCode",
        required: true,
      },
      value: {
        type: String,
        required: true,
        index: true,
      },
      referenceNumber: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: Object.values(QrCodeType),
        required: false,
        index: true,
      },
    }),
  )
  qrCode?: ExtendedQrCode;
  @Prop(
    raw({
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
      level: {
        type: Number,
        required: true,
      },
      isSubProfile: {
        type: Boolean,
        required: true,
      },
      parentProfile: {
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: false,
      },
      role: {
        type: String,
        enum: Object.values(UserRole),
        required: false,
      },
    }),
  )
  userType: UserTypeData;
  @Prop({ type: String, required: true, index: true })
  scanAction: string;
  @Prop({ type: Array, required: false, index: true })
  qrCodes: string[];
  @Prop({ type: String, required: false })
  fraudMessage: string;
  @Prop({ type: Boolean, required: false, index: true })
  isMainScanLog: boolean;

  @Prop({ type: String, enum: Object.values(WalletType), required: false })
  walletType: WalletType;

  @Prop({ type: Boolean, required: false })
  isActionMaker: boolean;

  @Prop({ type: Number, required: false })
  quantifiedIncentivePoints: number;

  @Prop({ type: Number, required: false })
  quantifiedIncentiveWheel: Number;
}
const ScanSchema = SchemaFactory.createForClass(Scan);
export { ScanSchema };
