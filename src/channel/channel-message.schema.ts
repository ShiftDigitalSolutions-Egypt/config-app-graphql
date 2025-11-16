import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Channel } from './channel.schema';
import { MessageStatus } from '../common/enums';

export type ChannelMessageDocument = ChannelMessage & Document;

// Register enum with GraphQL
registerEnumType(MessageStatus, {
  name: 'MessageStatus',
  description: 'Status of a message in the aggregation workflow',
});

@ObjectType()
export class AggregationData {
  @Field({ nullable: true })
  @Prop({ required: false })
  targetQr?: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  childQrCode?: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  productId?: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  eventType?: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  metadata?: string;
}

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

  @Field(() => MessageStatus)
  @Prop({ 
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.PROCESSING,
    index: true
  })
  status: MessageStatus;

  @Field(() => AggregationData, { nullable: true })
  @Prop({
    type: {
      targetQr: { type: String, required: false },
      childQrCode: { type: String, required: false },
      productId: { type: String, required: false },
      eventType: { type: String, required: false },
      metadata: { type: String, required: false },
    },
    required: false
  })
  aggregationData?: AggregationData;

  @Field({ nullable: true })
  @Prop({ required: false })
  errorMessage?: string;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;

  @Field()
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChannelMessageSchema = SchemaFactory.createForClass(ChannelMessage);