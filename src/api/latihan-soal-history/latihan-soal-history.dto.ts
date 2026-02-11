import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LatihanSoalHistoryQuery {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsUUID()
  topic_id?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  min_year: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  max_year: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  limit: number;
}
