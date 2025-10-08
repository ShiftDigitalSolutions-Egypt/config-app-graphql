import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MethodType } from './_end-of-month.entity';

export type AllMethodDocument = AllMethod & Document;

@Schema()
export class AllMethod {
  method?: MethodType;

  @Prop({ type: Number, required: true })
  value?: number;
}

const AllMethodSchema = SchemaFactory.createForClass(AllMethod);

export { AllMethodSchema };
