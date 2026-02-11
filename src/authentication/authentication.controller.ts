/* eslint-disable @typescript-eslint/no-unused-vars */

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import {
  AuthDto,
  AuthEmailDto,
  PasswordLoginDto,
  SendOtpDto,
  SendOtpEmailDto,
  VerifyMailOtpDto,
} from './authentication.dto';
import { Request } from 'express';
import { JwtAuthGuard } from './guard/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingGuard } from 'src/api/users/guards/onboarding.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('login')
  async login(@Body() loginDto: AuthDto) {
    const res = await this.authenticationService.login(loginDto);
    return res;
  }

  @Post('password-login')
  async loginPassword(@Body() loginDto: PasswordLoginDto) {
    const res = await this.authenticationService.passwordLogin(loginDto);
    return res;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const res = await this.authenticationService.sendOtp(sendOtpDto);

    return res;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('onboard-password')
  async onboardPassword(@Body() updatePasswordDto: PasswordLoginDto) {
    const res = await this.authenticationService.updatePassword(
      updatePasswordDto,
    );
    return res;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseGuards(OnboardingGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    const res = await this.authenticationService.getMyProfile(
      (req.user as any).userId as string,
    );

    return res;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: AuthDto) {
    const res = await this.authenticationService.forgotPassword(
      forgotPasswordDto,
    );
    return res;
  }

  @Post('otp-reset')
  async otpReset(@Body() otpResetDto: SendOtpDto) {
    const res = await this.authenticationService.sendOTPResetPassword(
      otpResetDto,
    );
    return res;
  }

  @Post('mail-verification')
  async sendEmailVerifaction(@Body() sendOtpEmailDto: SendOtpEmailDto) {
    const res = await this.authenticationService.sendEmailVerification({
      email: sendOtpEmailDto.email,
    });
    return res;
  }

  @Post('verify-mail')
  async verifyMailOtp(@Body() verifyOtpDto: VerifyMailOtpDto) {
    console.log(verifyOtpDto);
    const res = await this.authenticationService.verifyMailOtp({
      otp: verifyOtpDto.otp,
      email: verifyOtpDto.email,
    });

    return res;
  }

  @Post('login-email')
  async loginEmail(@Body() loginDto: AuthEmailDto) {
    const res = await this.authenticationService.loginEmail(loginDto);
    return res;
  }

  @Post('forgot-password-email')
  async forgotPasswordEmail(@Body() { email }: { email: string }) {
    const res = await this.authenticationService.forgotPasswordEmail(email);
    return res;
  }

  @Post('otp-reset-email')
  async otpResetEmail(@Body() { email, otp }: { email: string; otp: string }) {
    const res = await this.authenticationService.verifyMailOtpForgotPassword({
      email: email,
      otp: otp,
    });
    return res;
  }
}
