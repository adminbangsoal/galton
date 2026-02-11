import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class AuthDto {
  @ApiProperty({
    example: '+628119950216',
  })
  @Matches(/^(\+62)[\s-]?(\d{9,16})$/, {
    message: 'Phone number is not valid',
  })
  phone_number: string;

  @ApiProperty({
    example: '123456',
  })
  @IsString()
  otp: string;
}

export class AuthEmailDto {
  @ApiProperty({
    example: 'izzuddinumar13@gmail.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    example: 'umar4321',
  })
  @IsString()
  password: string;
}

export class PasswordLoginDto {
  @ApiProperty({
    example: '+628119950216',
  })
  @Matches(/^(\+62)[\s-]?(\d{9,16})$/, {
    message: 'Phone number is not valid',
  })
  phone_number: string;

  @ApiProperty({
    example: 'password',
  })
  @IsString()
  password: string;
}

export class SendOtpEmailDto {
  @ApiProperty({
    example: 'izzuddinumar13@gmail.com'
  })
  @IsEmail()
  email: string;
}

export class SendOtpDto {
  @ApiProperty({
    example: '+628119950216',
  })
  @Matches(/^(\+62)[\s-]?(\d{9,16})$/, {
    message: 'Phone number is not valid',
  })
  phone_number: string;
}

export class VerifyOtpDto {
  phone_number: string;
  otp: string;
}

export class VerifyMailOtpDto {
  @ApiProperty({
    example: '123456',
  })
  @IsString()
  otp: string;


  @ApiProperty({
    example: 'izzuddinumar13@gmail.com',
  })
  @IsString()
  email: string;
}
