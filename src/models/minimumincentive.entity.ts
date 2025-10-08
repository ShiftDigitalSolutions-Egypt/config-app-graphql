import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from "./supplier.entity";
import { UserType } from "./user-type.entity";
import { Vertical } from "./vertical.entity";

export type MinimumincentiveDocument = Minimumincentive & Document;
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
export class Minimumincentive {
  id?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: UserType.name, required: true })
  userType: string;
  @Prop({ type: Number })
  minimumincentive: number;

  @Prop({ type: Boolean })
  activateWallet: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Supplier.name, required: false })
  supplier: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Vertical.name, required: false })
  vertical: string;
}
export const MinimumincentiveSchema = SchemaFactory.createForClass(Minimumincentive);
