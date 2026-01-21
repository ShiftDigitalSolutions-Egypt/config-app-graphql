import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ChannelStatus, SessionMode } from '../common/enums';
import { ExtendedProductType } from '@/models/scan.entity';
import { ExtendedProduct } from '@/models/pause-session.entity';

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

  @Field(() => String, { nullable: true })
  @Prop({ 
    type: String,
    enum: ['PALLET', 'PACKAGE'],
    required: false,
  })
  aggregationType?: 'PALLET' | 'PACKAGE';

  @Field({ nullable: true })
  @Prop({ required: false })
  userId?: string;

  @Field(() => String, { nullable: true })
  @Prop({ required: false })
  targetQrCode?: string;

  @Field(() => [String], { nullable: true })
  @Prop({ type: [String], default: [] })
  processedQrCodes?: string[];

  @Field(() => [String], { nullable: true })
  @Prop({ type: [String], default: [] })
  processedPackageQrCodes?: string[];

  @Field()
  @Prop({ required: true })
  productId: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  outersPerPackage?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentPackageQr?: string;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentPackagesCount?: number;

  @Field(() => String, { nullable: true, description: 'Product details object in JSON format' })
  @Prop({ type: Object, required: false })
  product?: ExtendedProduct;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;

  @Field()
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);