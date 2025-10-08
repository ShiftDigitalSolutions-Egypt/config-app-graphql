import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ProductType } from './product-type.entity';
import { QaraService } from './qara-service.schema';
import { Supplier } from './supplier.entity';

export type RabehSupplierDocument = RabehSupplier & Document;

interface SupplierService {
  _id: string;
  name: string;
}

interface SupplierProductType {
  _id: string;
  name: string;
  enabled: boolean;
}

export interface ServicesProductType {
  service: SupplierService;
  productTypes: SupplierProductType[];
}
@Schema({
  timestamps: true,
  toJSON: {
    getters: true,
    virtuals: true,
    transform: (_, doc: Record<string, unknown>) => {
      //prevent this fields from returning in a response
      delete doc.__v;
      return {
        ...doc,
      };
    },
  },
})
export class RabehSupplier {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
    unique: true,
  })
  supplierId: string;

  @Prop({ required: true })
  supplierName: string;

  @Prop(
    raw([
      {
        _id: false,
        service: {
          _id: {
            type: MongooseSchema.Types.ObjectId,
            ref: QaraService.name,
            required: true,
          },
          name: { type: String, required: true },
        },
        productTypes: [
          {
            _id: {
              type: MongooseSchema.Types.ObjectId,
              ref: ProductType.name,
              required: true,
            },
            name: { type: String, required: true },
            enabled: { type: Boolean, required: true, default: true },
          },
        ],
      },
    ]),
  )
  servicesProductTypes: ServicesProductType[];
}

export const RabehSuppliersSchema = SchemaFactory.createForClass(RabehSupplier);
