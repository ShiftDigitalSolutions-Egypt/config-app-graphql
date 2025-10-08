import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Actions, UserType, UserTypeDocument } from './user-type.entity';
import { Supplier, SupplierDocument } from './supplier.entity';

export interface ProductTypeExtended {
  productTypeId: string;
  duration: number;
  isEnabled: boolean;
}

export type HoldIncentiveDocument = HoldIncentive & Document;

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
export class HoldIncentive {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string | UserTypeDocument;

  @Prop({ type: String, enum: Object.values(Actions), required: false })
  action: Actions;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string | SupplierDocument;

  @Prop(
    raw([
      {
        _id: false,
        productTypeId: {
          type: MongooseSchema.Types.ObjectId,
          ref: ProductType.name,
          required: true,
        },
        duration: { type: Number, default: 0 },
        isEnabled: { type: Boolean, default: true },
      },
    ]),
  )
  productTypes: ProductTypeExtended[];

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;
}

const HoldIncentiveSchema = SchemaFactory.createForClass(HoldIncentive);

export { HoldIncentiveSchema };
