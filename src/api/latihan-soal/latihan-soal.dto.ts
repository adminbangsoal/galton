import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  IsIn,
} from 'class-validator';
import { questionTypes } from '../../database/schema';

export class LatihanSoalQuery {
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
  @IsUUID()
  question_id?: string; // random id

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
}

export class AttemptQuestionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  choice_id: string;

  @ApiProperty({
    example: ['answers'],
  })
  @IsArray()
  @IsString({ each: true })
  answers: string[];

  @ApiProperty({
    example: 'answer',
  })
  @IsString()
  answer_history: string;
}

export class AttemptTimedQuestionDTO {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  question_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  choice_id: string;

  @ApiProperty({
    example: ['answers'],
  })
  @IsArray()
  @IsString({ each: true })
  answers: string[];

  @ApiProperty({
    example: 'answer',
  })
  @IsString()
  answer_history: string;
}

export class AddSubmissionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  attempt_id: string;

  @ApiProperty({
    example: 's3-url',
  })
  @IsUrl()
  asset_url: string;
}

export class GeneratePDFDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  topic_id?: string;

  @ApiProperty({
    example: 2021,
  })
  @IsOptional()
  @IsNumber()
  min_year?: number;

  @ApiProperty({
    example: 2023,
  })
  @IsOptional()
  @IsNumber()
  max_year?: number;
}

export class AddUpdateFeedbackDto {
  @ApiProperty({
    example: 'true',
  })
  @IsBoolean()
  is_like: boolean;

  @ApiProperty({
    example: 'feedback',
  })
  @IsString()
  feedback: string;
}

export class UpdateLatihanSoalDTO {
  @ApiProperty({
    example: 'UTBK',
  })
  @IsString()
  source: string;
  @ApiProperty({
    example: 2021,
  })
  @IsNumber()
  year: number;
  @ApiProperty({
    example: [
      {
        content: 'Kapan indonesia merdeka?',
        isMedia: false,
      },
    ],
  })
  @IsArray()
  question: {
    content: string;
    isMedia: boolean;
  }[];
  @ApiProperty({
    example: [
      {
        content: 'Indonesia merdeka di tahun 1945',
        isMedia: false,
      },
    ],
  })
  @IsArray()
  answers: {
    content: string;
    isMedia: boolean;
  }[];

  @ApiProperty({
    example: ['Jakarta', 'Bandung'],
  })
  @IsArray()
  filled_answer: string[];

  @ApiProperty({
    example: '9970d34d-b494-4da8-b0d4-b1cdb6b9225d',
  })
  @IsUUID()
  id: string;
  @ApiProperty({
    example: '9970d34d-b494-4da8-b0d4-b1cdb6b9225d',
  })
  @IsUUID()
  topic_id: string;

  @ApiProperty({
    example: 'multiple-choice',
  })
  @IsString()
  @IsIn(questionTypes.enumValues)
  type: 'multiple-choice' | 'fill-in' | 'table-choice' | 'multiple-answer';

  @ApiProperty({
    example: [
      {
        id: '9970d34d-b494-4da8-b0d4-b1cdb6b9225d',
        content: '1957',
        is_true: false,
        key: 'A',
      },
      {
        id: 'eb806954-e567-4c9b-ab79-aabd90890ac4',
        content: '1945',
        is_true: true,
        key: 'B',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  options?: {
    content: string;
    is_true: boolean;
    key: string;
  }[];

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  published: boolean;
}

export class CreateSequentialQuestionsDto {
  @ApiProperty({
    example: 20,
  })
  @IsNumber()
  max_number: number;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsArray()
  @IsString({ each: true })
  topic_ids: string[];
}

export class AttemptSequentialQuestionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  answer_history: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  choice_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  options_id: string;
}

export class GetAttemptTimedQuestionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  question_id: string;
}

export class GetTimedQuestionsListBySubjectDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  subject_id: string;
}

export class ChangeCurrentQuestionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  question_id: string;
  @ApiProperty({
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  current_number: number;
}
