import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ChannelStatus } from '@/common/enums';

export type ChannelDocument = Channel & Document;

// Register enum with GraphQL
registerEnumType(ChannelStatus, {
  name: 'ChannelStatus',
  description: 'Status of a channel in the aggregation workflow',
});

@ObjectType()
@Schema({ timestamps: true, collection: 'channels' })
export class Channel {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field(() => String, { nullable: true })
  @Prop({ required: false })
  orderQrCode?: string;

  @Field(() => ChannelStatus)
  @Prop({ 
    type: String,
    enum: Object.values(ChannelStatus),
    default: ChannelStatus.DRAFT,
    index: true
  })
  status: ChannelStatus;

  @Field(() => Date, { nullable: true })
  @Prop({ required: false })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  @Prop({ required: false })
  endDate?: Date;

  @Field({ nullable: true })
  @Prop({ required: false })
  userId?: string;

  @Field(() => String, { nullable: true, description: 'Additional metadata in JSON format' })
  @Prop({ type: Object, required: false })
  metadata?: Record<string, any>;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;

  @Field()
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);

// Add indexes
ChannelSchema.index({ status: 1 });
ChannelSchema.index({ userId: 1 });
ChannelSchema.index({ orderQrCode: 1 });