import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
export type DeviceuseraccountDocument = Deviceuseraccount & Document;

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
export class Deviceuseraccount {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Vertical.name,
    required: false,
  })
  vertical: string;
  @Prop({ type: String })
  username: string;
  @Prop({ type: String })
  password: string;
  @Prop({ type: String })
  role: string;
}
const DeviceuseraccountSchema = SchemaFactory.createForClass(Deviceuseraccount);

export { DeviceuseraccountSchema };
