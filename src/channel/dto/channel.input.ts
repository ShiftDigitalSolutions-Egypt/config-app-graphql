import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

@InputType()
export class CreateChannelInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateChannelInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}