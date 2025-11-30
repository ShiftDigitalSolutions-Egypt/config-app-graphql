import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ChannelStatus, SessionMode } from '../common/enums';

export type ChannelDocument = Channel & Document;

// Register enums with GraphQL
registerEnumType(ChannelStatus, {
  name: 'ChannelStatus',
  description: 'Status of a channel in the aggregation workflow',
});

registerEnumType(SessionMode, {
  name: 'SessionMode',
  description: 'Mode of the aggregation session',
});

@ObjectType()
@Schema({ timestamps: true })
export class Channel {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field({ nullable: true })
  @Prop()
  description?: string;

  @Field(() => ChannelStatus)
  @Prop({ 
    type: String,
    enum: Object.values(ChannelStatus),
    default: ChannelStatus.OPEN,
    index: true
  })
  status: ChannelStatus;

  @Field(() => SessionMode, { nullable: true })
  @Prop({ 
    type: String,
    enum: Object.values(SessionMode),
    required: false,
    index: true
  })
  sessionMode?: SessionMode;

  @Field({ nullable: true })
  @Prop({ required: false })
  userId?: string;

  @Field(() => String, { nullable: false })
  @Prop({ required: true })
  targetQrCode: string;

  @Field(() => [String], { nullable: true })
  @Prop({ type: [String], default: [] })
  processedQrCodes: string[];

  @Field()
  @Prop({ required: true })
  productId: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  packagesPerPallet?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  outersPerPackage?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentPackageIndex?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentOuterCount?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentPackageQr?: string;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;

  @Field()
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);