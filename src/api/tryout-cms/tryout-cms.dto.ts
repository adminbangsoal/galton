import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TryoutTypeEnum } from './tryout-cms.enum';

export class CreateTryoutDto {
  @ApiProperty({
    example: 'Tryout 1',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'https://www.google.com',
  })
  @IsString()
  @IsOptional()
  logo_src: string;

  @ApiProperty({
    example: 'This is tryout description',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: '2021-10-10',
  })
  @IsDateString()
  expiry_date: string;

  @ApiProperty({
    example: 4,
  })
  @IsInt()
  @IsOptional()
  correct_base_point?: number;

  @ApiProperty({
    example: -1,
  })
  @IsInt()
  @IsOptional()
  wrong_base_point?: number;

  @ApiProperty({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_irt?: boolean;

  @ApiProperty({
    example: 'SIMAK',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    example: 600,
  })
  @IsNumber()
  buffer_duration: number;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_kilat?: boolean;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_window?: boolean;
}

export class CreateTryoutSetDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  tryout_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  subject_id: string;
}

export class SwapTryoutSetDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  tryout_set_id_1: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174987',
  })
  @IsUUID()
  tryout_set_id_2: string;
}

export class UpdateTryoutDto {
  @ApiProperty({
    example: 'Tryout 1',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'https://www.google.com',
  })
  @IsString()
  @IsOptional()
  logo_src?: string;

  @ApiProperty({
    example: 'This is tryout description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2021-10-10',
  })
  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @ApiProperty({
    example: 4,
  })
  @IsInt()
  @IsOptional()
  correct_base_point?: number;

  @ApiProperty({
    example: -1,
  })
  @IsInt()
  @IsOptional()
  wrong_base_point?: number;

  @ApiProperty({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_irt?: boolean;

  @ApiProperty({
    example: 'SIMAK',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    example: 600,
  })
  @IsNumber()
  @IsOptional()
  buffer_duration?: number;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_kilat?: boolean;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_window?: boolean;
}

export class UpdateTryoutSetDto {
  @IsNumber()
  duration: number;

  @IsUUID()
  id: string;

  @IsNumber()
  order: number;
}

export class CreateTryoutQuestionDto {
  @IsString()
  question: string;

  @IsString()
  @IsOptional()
  question_image: string;

  @IsArray()
  options: {
    content: string;
    is_true: boolean;
    key: string;
  }[];

  @IsBoolean()
  @IsOptional()
  is_mcq: boolean;

  @IsString()
  pembahasan: string;

  @IsString()
  @IsOptional()
  pembahasan_image: string;

  @IsUUID()
  @IsOptional()
  question_id: string;

  @IsString()
  source: string;

  @IsEnum(TryoutTypeEnum)
  type: TryoutTypeEnum;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  answers: string[];
}

export class CreateSubjectDto {
  @IsUUID()
  tryout_id: string;

  @IsString()
  name: string;

  @IsNumber()
  question_limit: number;

  @IsNumber()
  time_limit: number;
}

export class UpdateTryoutQuestionDto {
  @IsString()
  @IsOptional()
  content: string;

  @IsString()
  @IsOptional()
  content_img: string;

  @IsArray()
  @IsOptional()
  options: {
    id: string;
    content: string;
    is_true: boolean;
    key: string;
  }[];

  @IsBoolean()
  @IsOptional()
  is_mcq: boolean;

  @IsOptional()
  @IsArray()
  explanations: {
    content: string;
    isMedia: boolean;
  }[];

  @IsOptional()
  @IsEnum(TryoutTypeEnum)
  type: TryoutTypeEnum;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  answers: string[];
}

export class DuplicateTryoutDto {
  @IsString()
  name: string;
}

export class GenerateTryoutSetPDF {
  @IsUUID()
  set_id: string;
}
