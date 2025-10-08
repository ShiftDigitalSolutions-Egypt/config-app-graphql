import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RequestType } from './_client-request.entity';

export type CashIncentiveDocument = CashIncentive & Document;

@Schema()
export class CashIncentive {
  type?: RequestType;

  @Prop({ type: Number, required: true })
  value?: number;
}

const CashIncentiveSchema = SchemaFactory.createForClass(CashIncentive);

export { CashIncentiveSchema };
