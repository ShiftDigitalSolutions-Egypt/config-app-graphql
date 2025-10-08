import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateQrConfigrationDto {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasAgg: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  numberOfAgg?: number;

  @Field()
  @IsMongoId()
  productId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  aggQrCode?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  qrCodeList: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  operationBatch: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  workerName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  productionsDate: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  orderNum: string;
}
