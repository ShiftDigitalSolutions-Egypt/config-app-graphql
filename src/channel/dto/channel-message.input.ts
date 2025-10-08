import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateChannelMessageInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  content: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  author: string;

  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  channelId: string;
}

@InputType()
export class UpdateChannelMessageInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  author?: string;
}