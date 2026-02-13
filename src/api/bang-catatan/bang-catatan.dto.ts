import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PageOptionsDto } from 'src/common/dtos/page.dtos';
import { BangCatatanThemeEnum, BangCatatanTipeEnum } from './bang-catatan.enum';

export class CreateBangCatatanDTO {
  @ApiProperty({
    example:
      'https://https://bangsoal.s3-ap-southeast-1.amazonaws.com/bangcatatan/73799331-5abb-4bd1-bd69-73a3796d101c-Screenshot.png',
  })
  @IsString()
  asset_url: string;

  @ApiProperty({
    example: 'Catatan Matematika',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Catatan Matematika Kelas 12 SMA',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example:
      'https://https://bangsoal.s3-ap-southeast-1.amazonaws.com/bangcatatan/73799331-5abb-4bd1-bd69-73a3796d101c-Screenshot.png',
  })
  @IsString()
  thumbnail_url: string;

  @ApiProperty({
    example: 'red',
    enum: BangCatatanThemeEnum,
  })
  @IsEnum(BangCatatanThemeEnum)
  color_pallete: BangCatatanThemeEnum;

  @ApiProperty({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsUUID()
  subject_id: string;

  @ApiProperty({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsUUID()
  topic_id: string;

  @ApiProperty({
    example: 'catatan',
    enum: BangCatatanTipeEnum,
  })
  @IsEnum(BangCatatanTipeEnum)
  note_type: BangCatatanTipeEnum;
}

export class GetCatatanTimelineDTO extends PageOptionsDto {
  @ApiPropertyOptional({
    example: 'Algebra',
  })
  @IsString()
  @IsOptional()
  query?: string; // title or author name

  @ApiPropertyOptional({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsUUID()
  @IsOptional()
  subject_id?: string;

  @ApiPropertyOptional({
    example: '73799331-5abb-4bd1-bd69-73a3796d101c',
  })
  @IsUUID()
  @IsOptional()
  topic_id?: string;

  @ApiPropertyOptional({
    example: 'catatan',
    enum: BangCatatanTipeEnum,
  })
  @IsEnum(BangCatatanTipeEnum)
  @IsOptional()
  note_type?: BangCatatanTipeEnum;

  @ApiPropertyOptional({
    example: 'true',
  })
  @IsBooleanString()
  @IsOptional()
  is_liked?: string;
}

export class ReportCatatanDTO {
  @ApiPropertyOptional({
    example: 'Wrong formula',
  })
  @IsString()
  reason: string;
}
