import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';

export type MultiOperationLogDocument = MultiOperationLog & Document;

export enum TransactionType {
  CONTINUITYINCENTIVE = 'CONTINUITYINCENTIVE',
  EXTRAINCENTIVE = 'EXTRAINCENTIVE',
  DEDUCTIONINCENTIVE = 'DEDUCTIONINCENTIVE',
}

@Schema({
  // plugin(autoIncrement.plugin, 'Book'),
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
export class MultiOperationLog {
  @Prop({ type: Number, required: true })
  userId: number;

  @Prop({ required: true, type: String, enum: Object.values(TransactionType) })
  transactionType?: TransactionType;

  @Prop({ type: Number, required: true })
  value: number;

  @Prop({ type: Number, required: true, default: 0 })
  previousBalance: number;

  @Prop({ type: Number, required: true, default: 0 })
  currentBalance: number;

  @Prop({ type: String, required: false })
  comment?: string;

  @Prop({ type: String, required: false })
  createdBy?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  supplier: ObjectId;
}

export const MultiOperationLogSchema =
  SchemaFactory.createForClass(MultiOperationLog);

// Add indexes for better query performance
MultiOperationLogSchema.index({ userId: 1 });
MultiOperationLogSchema.index({ operationId: 1 });
MultiOperationLogSchema.index({ createdAt: -1 });
