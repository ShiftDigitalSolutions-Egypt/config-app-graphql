import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';

export type MarketPlaceOpenUserDocument = MarketPlaceOpenUser & Document;
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
export class MarketPlaceOpenUser {
  @Prop({ type: MongooseSchema.Types.ObjectId, refPath: 'collectionType', required: true, unique: true })
  openId: ObjectId;
  @Prop({ type: String, required: true })
  collectionType: string;
}
export const MarketPlaceOpenUserSchema = SchemaFactory.createForClass(MarketPlaceOpenUser);
