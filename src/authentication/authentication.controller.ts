import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import {
  RegisterDto,
  LoginDto,
  GoogleSignInDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './authentication.dto';
import { Request } from 'express';
import { JwtAuthGuard } from './guard/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingGuard } from '../api/users/guards/onboarding.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    throw new BadRequestException(
      'Sign up manual sudah dinonaktifkan. Silakan gunakan Google Sign In.',
    );
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    throw new BadRequestException(
      'Sign in manual sudah dinonaktifkan. Silakan gunakan Google Sign In.',
    );
  }

  @Post('google')
  async googleSignIn(@Body() googleSignInDto: GoogleSignInDto) {
    return await this.authenticationService.googleSignIn(googleSignInDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseGuards(OnboardingGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    return await this.authenticationService.getMyProfile(
      (req.user as any).userId as string,
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    throw new BadRequestException(
      'Fitur lupa password sudah dinonaktifkan. Silakan gunakan Google Sign In.',
    );
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    throw new BadRequestException(
      'Fitur reset password sudah dinonaktifkan. Silakan gunakan Google Sign In.',
    );
  }
}
