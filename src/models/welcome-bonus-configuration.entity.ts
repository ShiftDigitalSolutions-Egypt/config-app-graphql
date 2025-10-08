import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Supplier } from './supplier.entity';
import { UserType } from './user-type.entity';


export type WelcomeBonusConfigurationDocument = WelcomeBonusConfiguration & Document;
@Schema({
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
export class WelcomeBonusConfiguration {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Supplier.name,
    required: true,
  })
  supplier: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: true,
  })
  userType: string;

  @Prop({
    type: Number,
    default: 0,
    required: true,
  })
  welcomeBonus: number;
}
const WelcomeBonusConfigurationSchema = SchemaFactory.createForClass(WelcomeBonusConfiguration);
export { WelcomeBonusConfigurationSchema };
