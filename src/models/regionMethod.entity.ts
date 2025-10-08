import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MethodType } from './_end-of-month.entity';

export type RegionMethodDocument = RegionMethod & Document;

@Schema()
export class RegionMethod {
  method?: MethodType;
}

const RegionMethodSchema = SchemaFactory.createForClass(RegionMethod);

export { RegionMethodSchema };
