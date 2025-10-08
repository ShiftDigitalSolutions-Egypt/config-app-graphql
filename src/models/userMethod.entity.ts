import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MethodType } from './_end-of-month.entity';

export type UserMethodDocument = UserMethod & Document;

@Schema()
export class UserMethod {
  method?: MethodType;

  @Prop({ type: String, required: true })
  usersLink?: string;
}

const UserMethodSchema = SchemaFactory.createForClass(UserMethod);

export { UserMethodSchema };
