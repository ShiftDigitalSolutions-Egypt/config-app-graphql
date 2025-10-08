// export class ResetLog {}
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ProductType } from './product-type.entity';
import { ProductData, QrCode } from './qr-code.entity';
import { QrCodeType, UserType } from './user-type.entity';
import { User, UserDocument } from './_user.model';
import { Warehouse, WarehouseDocument } from './warehouse.entity';

export type ResetLogDocument = ResetLog & Document;

export enum OperationType {
  RESET = 'RESET',
  REPLACE = 'REPLACE',
  UNLINK = 'UNLINK',
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

export interface ExtendedQrCode {
  type: QrCodeType;
  id: string;
  value: string;
  referenceNumber: string;
}

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
export class ResetLog {
  @Prop({ type: Number, required: false, default: 0 })
  outersCounter: number;

  @Prop({ type: Number, required: false, default: 0 })
  packageCounter: number;

  @Prop({ type: Number, required: false, default: 0 })
  palletCounter: number;

  @Prop({ required: false, type: String, enum: Object.values(OperationType) })
  opereationType: OperationType;

  @Prop(
    raw({
      // _id: false,
      _id: {
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
      // _id: false,
      _id: {
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
  vertical: ExtendedVertical;

  @Prop(
    raw({
      // _id: false,
      _id: {
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

  @Prop({
    type: [
      {
        productId: { type: MongooseSchema.Types.ObjectId },
        counter: Number,
        outers: Number,
        pallets: Number,
        packages: Number,
      },
    ],
    required: false,
    each: true,
  })
  productData: ProductData[];

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: QrCode.name,
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
  qrCodeValue?: ExtendedQrCode;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: QrCode.name,
        required: false,
      },
      value: {
        type: String,
        required: false,
        index: true,
      },
      referenceNumber: {
        type: String,
        required: false,
      },
      type: {
        type: String,
        enum: Object.values(QrCodeType),
        required: false,
        index: true,
      },
    }),
  )
  UpdatedqrCodeValue?: ExtendedQrCode;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Warehouse.name,
    required: false,
  })
  warehouse: string | WarehouseDocument;

  @Prop({ type: String, required: false })
  orderQr: string;
}
const ResetLogSchema = SchemaFactory.createForClass(ResetLog);
export { ResetLogSchema };
