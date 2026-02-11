import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class AddFeedbackDto {
  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  is_liked: boolean;
}

export class AddQuestionNoteDto {
  @ApiProperty({
    example:
      'https://https://bangsoal.s3-ap-southeast-1.amazonaws.com/tryout-question-note/73799331-5abb-4bd1-bd69-73a3796d101c-Screenshot.png',
  })
  @IsString()
  asset_url: string;
}

export class JobDto {
  @ApiProperty({
    example: '34abb710-c78d-47a7-b74a-9ad70705f084'
  })
  @IsString()
  tryout_id: string;
}