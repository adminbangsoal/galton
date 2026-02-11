import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  SubscriptionTypeEnum,
  SubscriptionsType,
} from 'src/database/schema/transaction-orders.schema';

export class CreateSnapDto {
  @ApiProperty({
    example: 'ambis',
    enum: SubscriptionsType,
  })
  @IsEnum(SubscriptionsType, {
    message: `subscription_type must be one of the following values: ${SubscriptionsType}`,
  })
  subscription_type: SubscriptionTypeEnum;

  @ApiProperty({
    example: 'ABC123',
  })
  @IsOptional()
  referal_code?: string;
}
