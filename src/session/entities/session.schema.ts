import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { SessionStatus, SessionMode } from '../../common/enums';
import { ExtendedProductType } from '@/models/scan.entity';
import { ExtendedProduct } from '@/models/pause-session.entity';

export type SessionDocument = Session & Document;

// Register enums with GraphQL
registerEnumType(SessionStatus, {
  name: 'SessionStatus',
  description: 'Status of a session in the aggregation workflow',
});

registerEnumType(SessionMode, {
  name: 'SessionMode',
  description: 'Mode of the aggregation session',
});

@ObjectType()
@Schema({ timestamps: true, collection: 'agg-sessions' })
export class Session {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field({ nullable: true })
  @Prop()
  description?: string;

  @Field(() => SessionStatus)
  @Prop({ 
    type: String,
    enum: Object.values(SessionStatus),
    default: SessionStatus.OPEN,
    index: true
  })
  status: SessionStatus;

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
    enum: ['PALLET', 'PACKAGE', 'FULL'],
    required: false,
  })
  aggregationType?: 'PALLET' | 'PACKAGE' | 'FULL';

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
  outersPerAggregation?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  currentAggregationsCount?: number;

  @Field({ nullable: true })
  @Prop({ required: false })
  packagesPerPallet?: number;

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

export const SessionSchema = SchemaFactory.createForClass(Session);