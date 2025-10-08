import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Governorate } from './governorate.entity';
import { MethodType } from './_end-of-month.entity';

export type GovernorateMethodDocument = GovernorateMethod & Document;
export interface GovernorateObj {
  id: string;
  name: string;
}

export interface Governorates {
  governorate: GovernorateObj;
  value: number;
}
@Schema()
export class GovernorateMethod {
  method?: MethodType;

  @Prop(
    raw([
      {
        _id: false,
        governorate: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: Governorate.name,
            required: true,
          },
          name: { type: String },
        },
        value: { type: Number, required: true },
      },
    ]),
  )
  governorates: Governorates[];
}

const GovernorateMethodSchema = SchemaFactory.createForClass(GovernorateMethod);

export { GovernorateMethodSchema };
