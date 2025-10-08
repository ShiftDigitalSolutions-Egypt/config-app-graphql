import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Channel } from './channel.schema';

export type ChannelMessageDocument = ChannelMessage & Document;

@ObjectType()
@Schema({ timestamps: true })
export class ChannelMessage {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true })
  content: string;

  @Field()
  @Prop({ required: true })
  author: string;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true })
  channelId: string;

  @Field(() => Channel, { nullable: true })
  channel?: Channel;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;

  @Field()
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChannelMessageSchema = SchemaFactory.createForClass(ChannelMessage);