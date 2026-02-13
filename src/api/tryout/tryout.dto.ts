import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TryoutModeEnum, TryoutProgressEnum } from './tryout.enum';

export class TryoutQueryDto {
  @ApiProperty({
    required: false,
    example: 'pro',
  })
  @IsOptional()
  @IsEnum(TryoutModeEnum, { message: 'Invalid tryout mode' })
  mode?: TryoutModeEnum;

  @ApiProperty({
    required: false,
    example: 'ongoing',
  })
  @IsOptional()
  @IsEnum(TryoutProgressEnum, { message: 'Invalid tryout progress' })
  progress?: TryoutProgressEnum;
}

export class AnswerQuestionDto {
  @ApiProperty({
    example: '12f6e4f0-6a38-4bc2-949a-44283768657z',
  })
  @IsUUID()
  question_id: string;

  @ApiProperty({
    example:
      'Ya benar, menurut saya ... . This could be a free text if not MCQ, else it must be the selected option id',
  })
  @IsString()
  answer: string;

  @ApiProperty({
    example: ['TRUE', '', 'FALSE', 'TRUE'],
  })
  @IsString({ each: true })
  filled_answers: string[];
}

export class ToggleQuestionFlagDto {
  @ApiProperty({
    example: '12f6e4f0-6a38-4bc2-949a-44283768657z',
  })
  @IsUUID()
  question_id: string;
}

export class StartTryoutDto {
  @ApiProperty({
    example: '12f6e4f0-6a38-4bc2-949a-44283768657z',
  })
  @IsUUID()
  tryout_id: string;

  @ApiProperty({
    example: 'A1B2C3',
  })
  @IsString()
  @IsOptional()
  event_code: string;
}

export class StartTryoutSetDto {
  @ApiProperty({
    example: '12f6e4f0-6a38-4bc2-949a-44283768657z',
  })
  @IsUUID()
  tryout_id: string;

  @ApiProperty({
    example: '55f6e4f0-6a38-4bc2-949a-44283768657d',
  })
  @IsUUID()
  set_id: string;
}

export class SubmitTryoutSetDto {
  @ApiProperty({
    example: '55f6e4f0-6a38-4bc2-949a-44283768657d',
  })
  @IsUUID()
  set_id: string;
}

export class SubmitTryoutDto {
  @ApiProperty({
    example: '55f6e4f0-6a38-4bc2-949a-44283768657d',
  })
  @IsUUID()
  tryout_id: string;
}

export class UpdateTryoutSetCurrentQuestionDto {
  @ApiProperty({
    example: '55f6e4f0-6a38-4bc2-949a-44283768657d',
  })
  @IsUUID()
  question_id: string;
}
