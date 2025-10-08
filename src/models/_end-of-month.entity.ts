import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Supplier, SupplierDocument } from './supplier.entity';
import { UserType } from './user-type.entity';

import { User, UserDocument } from './_user.model';
import { Vertical, VerticalDocument } from './vertical.entity';

export type EndOfMonthDocument = EndOfMonth & Document;

export interface UserTypeInterFace {
  id: string;

  name: string;
}
export enum MethodType {
  USERS = 'USERS',
  REGION = 'REGION',
  GOVERNORATE = 'GOVERNORATE',
  DISTRICT = 'DISTRICT',
  SEGMENT = 'SEGMENT',
  APPLYALL = 'APPLYALL',
}

export enum Status {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
}
@Schema({
  discriminatorKey: 'method',
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
export class EndOfMonth {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  user?: string | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier?: string | SupplierDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical?: string | VerticalDocument;

  @Prop(
    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: false,
      },
      name: {
        type: String,
        required: true,
      },
    }),
  )
  userType: UserTypeInterFace;

  @Prop({ required: true, type: String, enum: Object.values(MethodType) })
  method?: MethodType;

  @Prop({ required: true, type: String, enum: Object.values(Status) })
  status?: Status;

  @Prop({ required: true, type: Date })
  date?: Date;

  @Prop({ type: Number, required: true })
  month?: number;

  @Prop({ type: Number, required: true })
  year?: number;

  @Prop({ type: Number, required: false, default: 1 })
  version?: number;

  @Prop({ type: Boolean, required: true, default: false })
  isMissing?: boolean;

  @Prop({ type: String, required: false })
  previewLink?: string;
}
const EndOfMonthSchema = SchemaFactory.createForClass(EndOfMonth);
export { EndOfMonthSchema };

// import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
// import { Document, Model, ObjectId } from 'mongoose';
// import * as mongoose from 'mongoose';

// import { UnprocessableEntityException } from '@nestjs/common';
// import { hash, compare } from 'bcryptjs';
// import { Constants } from '../../utils/constants';
// import { Password } from '../../auth/utils/Password';
// import { Branch } from './branch.entity';

// // export type ProductDocument = Product & Document;
// export type ProductDocument = Product & Document;

// export enum ProductType {
//     TEST = 'test',
//     PACKAGE = 'package',
//     OFFER = 'offer',
// }

// @Schema({
//     discriminatorKey: 'type',
//     timestamps: true,
//     toJSON: {
//         getters: true,
//         virtuals: true,
//         transform: (_, doc: Record<string, unknown>) => {
//             delete doc.__v;
//             delete doc._id;
//             return {
//                 ...doc,
//             };
//         },
//     },
// })
// export class Product {
//     id?: string;

//     @Prop({
//         default:
//             "https://res.cloudinary.com/nile-pharmacy/image/upload/v1558858260/assets/placeholder_a1ubee.jpg",
//     })
//     image?: string;

//     @Prop({
//         default:
//             "https://res.cloudinary.com/nile-pharmacy/image/upload/v1558858260/assets/placeholder_a1ubee.jpg",
//     })
//     icon?: string;

//     @Prop({ required: true })
//     titleAr: string;

//     @Prop()
//     titleEn: string;

//     @Prop()
//     price?: number;

//     @Prop({
//         min: 1,
//         default: null,
//     })
//     priceAfterDiscount?: number;
//     @Prop(raw([{ type: mongoose.Schema.Types.ObjectId, ref: Branch.name }]))
//     branches: string[];
//     @Prop({ required: true, type: String, enum: Object.values(ProductType) })
//     type: ProductType;

// }

// const ProductsSchema = SchemaFactory.createForClass(Product);

// export { ProductsSchema };
