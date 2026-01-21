import { InputType, Field, ID } from "@nestjs/graphql";
import { GraphQLJSON } from 'graphql-type-json';
import { IsNotEmpty, IsString, IsOptional, IsEnum, ValidateIf, ValidationArguments, registerDecorator, ValidationOptions } from "class-validator";
import { SessionMode } from "../../common/enums";
import { ExtendedProduct } from "@/models/pause-session.entity";

/**
 * Custom validator to enforce aggregationType field constraints based on sessionMode
 * 
 * Rules:
 * - When sessionMode is TWO_LEVEL_AGGREGATION: aggregationType is REQUIRED (must be 'PALLET' or 'PACKAGE')
 * - When sessionMode is PALLET_AGGREGATION or SCANNER: aggregationType must NOT be provided
 */
function IsAggregationTypeAllowed(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAggregationTypeAllowed',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as startAggregationInput;
          const { sessionMode } = obj;
          
          // Rule 1: TWO_LEVEL_AGGREGATION requires aggregationType
          if (sessionMode === SessionMode.TWO_LEVEL_AGGREGATION) {
            return value !== undefined && value !== null && value !== '';
          }
          
          // Rule 2: Other modes must not have aggregationType
          if (sessionMode === SessionMode.PALLET_AGGREGATION || sessionMode === SessionMode.SCANNER) {
            return value === undefined || value === null;
          }
          
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as startAggregationInput;
          const { sessionMode } = obj;
          
          if (sessionMode === SessionMode.TWO_LEVEL_AGGREGATION) {
            return `aggregationType field is required when sessionMode is "TWO_LEVEL_AGGREGATION". Please provide either "PALLET" or "PACKAGE".`;
          }
          
          if (sessionMode === SessionMode.PALLET_AGGREGATION) {
            return `aggregationType field is not allowed when sessionMode is "PALLET_AGGREGATION". Please remove this field from your request.`;
          }
          
          if (sessionMode === SessionMode.SCANNER) {
            return `aggregationType field is not allowed when sessionMode is "SCANNER". Please remove this field from your request.`;
          }
          
          return `aggregationType field can only be specified when sessionMode is "TWO_LEVEL_AGGREGATION".`;
        },
      },
    });
  };
}

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

  @Field(() => String, { nullable: true })
  @ValidateIf((o) => o.aggregationType !== undefined && o.aggregationType !== null)
  @IsEnum(['PALLET', 'PACKAGE'])
  @IsAggregationTypeAllowed()
  aggregationType?: 'PALLET' | 'PACKAGE';

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetQrCode?: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  productId: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Product details object' })
  @IsOptional()
  product?: ExtendedProduct;
}

@InputType()
export class ProcessAggregationMessageInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  channelId: string;

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
