import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class OnboardingDto {
  @ApiProperty({
    example: 'Umar Izzuddin',
  })
  @IsString()
  @IsOptional()
  full_name: string;

  @ApiProperty({
    example: 'umar4321'
  })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({
    example: 'SMAN 3 Depok',
  })
  @IsString()
  @IsOptional()
  highschool: string;

  @ApiProperty({
    example: 'University of Indonesia',
  })
  @IsString()
  @IsOptional()
  choosen_university_one: string;

  @ApiProperty({
    example: 'XYZABC',
  })
  @IsString()
  @IsOptional()
  referral_code: string;

  @ApiProperty({
    example: 'Website',
  })
  @IsString()
  @IsOptional()
  source: string;

  @ApiProperty({
    example: 'Computer Science',
  })
  @IsString()
  @IsOptional()
  choosen_major_one: string;

  @ApiProperty({
    example: '2021',
  })
  @IsString()
  @IsOptional()
  highschool_year: string;

  @ApiProperty({
    example: 'University of Indonesia',
  })
  @IsString()
  @IsOptional()
  choosen_university_two?: string;

  @ApiProperty({
    example: 'Computer Science',
  })
  @IsString()
  @IsOptional()
  choosen_major_two?: string;

  @ApiProperty({
    example: 'University of Indonesia',
  })
  @IsString()
  @IsOptional()
  choosen_university_three?: string;

  @ApiProperty({
    example: 'Computer Science',
  })
  @IsString()
  @IsOptional()
  choosen_major_three?: string;

  @ApiProperty({
    example: 'izzuddinumar13@gmail.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+628111111111',
  })
  @IsString()
  @IsOptional()
  phone_number: string;
}

export class UpdateUserProfileDto extends OnboardingDto {

  @ApiProperty({
    example: 's3-url',
  })
  @IsUrl()
  @IsOptional()
  profile_img?: string;
}

export class RegisterTryoutDto {
  @ApiProperty({
    example: 's3-url',
  })
  @IsUrl()
  @IsOptional()
  first_task_submission?: string;

  @ApiProperty({
    example: 's3-url',
  })
  @IsUrl()
  @IsOptional()
  second_task_submission?: string;

  @ApiProperty({
    example: 's3-url',
  })
  @IsUrl()
  @IsOptional()
  third_task_submission?: string;
}
