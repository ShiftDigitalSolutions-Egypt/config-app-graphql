import { InputType, Field, ID } from "@nestjs/graphql";
import { IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator";
import { SessionMode } from "../../common/enums";

@InputType()
export class StartPackageAggregationInput {
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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  targetQrCode: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  productId: string;
}

@InputType()
export class ProcessAggregationMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  channelId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  outerQrCode?: string;

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
export class UpdateChannelStatusInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  channelId: string;

  @Field()
  @IsEnum(["PAUSED", "CLOSED", "FINALIZED"])
  status: "PAUSED" | "CLOSED" | "FINALIZED";
}

@InputType()
export class FinalizeChannelInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  channelId: string;
}
