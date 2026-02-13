import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUpdateModalDto {
  @ApiProperty({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    example: 'New Feature',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'New Feature blabla',
  })
  @IsString()
  content: string;

  @ApiProperty({
    example: '2021-10-10',
  })
  @IsDateString()
  started_at: string;

  @ApiProperty({
    example: '2021-10-12',
  })
  @IsDateString()
  expired_at: string;

  @ApiProperty({
    example: 'https://bangsoal.s3-ap-southeast-1.amazonaws.com/XXXXX',
  })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({
    example: 'https://bangsoal.com/XXX',
  })
  @IsString()
  @IsOptional()
  redirect_url?: string;

  @ApiProperty({
    example: 'Check Now!',
  })
  @IsString()
  @IsOptional()
  button_name?: string;

  @ApiProperty({
    example: 'https://bangsoal.com/XXX',
  })
  @IsString()
  @IsOptional()
  button_url?: string;
}

export class DeleteUpdateModalDto {
  @ApiProperty({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsString()
  id: string;
}
