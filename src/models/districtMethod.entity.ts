import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';

import { District } from './district.entity';
import { MethodType } from './_end-of-month.entity';

export type DistrictMethodDocument = DistrictMethod & Document;

export interface DistrictObj {
  id: string;
  name: string;
}

export interface Districts {
  district: DistrictObj;
  value: number;
}
@Schema()
export class DistrictMethod {
  method?: MethodType;

  @Prop(
    raw([
      {
        _id: false,
        district: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: District.name,
            required: true,
          },
          name: { type: String },
        },
        value: { type: Number, required: true },
      },
    ]),
  )
  districts: Districts[];
}

const DistrictMethodschema = SchemaFactory.createForClass(DistrictMethod);

export { DistrictMethodschema };
