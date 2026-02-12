import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
  })
  @IsString()
  password: string;
}

export class GoogleSignInDto {
  @ApiProperty({
    example: 'firebase-id-token-here',
    description: 'Firebase ID token from frontend',
  })
  @IsString()
  idToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'reset-token-here',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'newpassword123',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

// Legacy DTOs - kept for backward compatibility but deprecated
export class AuthEmailDto {
  @ApiProperty({
    example: 'izzuddinumar13@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'umar4321',
  })
  @IsString()
  password: string;
}
