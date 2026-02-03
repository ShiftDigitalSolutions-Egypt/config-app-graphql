import { InputType, Field, ID } from "@nestjs/graphql";
import { GraphQLJSON } from 'graphql-type-json';
import { IsNotEmpty, IsString, IsOptional, IsEnum, ValidateIf, IsDefined } from "class-validator";
import { SessionMode } from "../../common/enums";
import { ExtendedProduct } from "@/models/pause-session.entity";


@InputType()
export class startAggregationInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => SessionMode)
  @IsEnum(SessionMode)
  sessionMode: SessionMode;

  /**
   * aggregationType rules:
   * - REQUIRED when sessionMode === AGGREGATION or DELIVERY_NOTE
   * - NOT ALLOWED for SCANNER (ignored by validation)
   */
  @Field(() => String, { nullable: true })
  @ValidateIf(o => o.sessionMode === SessionMode.AGGREGATION || o.sessionMode === SessionMode.DELIVERY_NOTE)
  @IsDefined()
  @IsEnum(['PALLET', 'PACKAGE', 'FULL'])
  aggregationType?: 'PALLET' | 'PACKAGE' | 'FULL';

  /**
   * channelId rules:
   * - OPTIONAL when sessionMode === DELIVERY_NOTE
   * - Ignored for other session modes (validation done at service layer)
   */
  @Field({ nullable: true })
  @ValidateIf(o => o.sessionMode === SessionMode.DELIVERY_NOTE)
  @IsOptional()
  @IsString()
  channelId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  productId: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Product details object',
  })
  @IsOptional()
  product?: ExtendedProduct;
}

@InputType()
export class ProcessAggregationMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @Field({ nullable: false })
  @IsNotEmpty()
  @IsString()
  childQrCode: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  author: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  eventType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  metadata?: string;
}

@InputType()
export class UpdateSessionStatusInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @Field()
  @IsEnum(["PAUSED", "CLOSED", "FINALIZED"])
  status: "PAUSED" | "CLOSED" | "FINALIZED";
}

@InputType()
export class FinalizeSessionInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  sessionId: string;
}
