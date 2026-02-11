import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Put,
  Param,
  UploadedFile,
  ParseFilePipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import { Request } from 'express';
import UsersService from './users.service';
import {
  OnboardingDto,
  RegisterTryoutDto,
  UpdateUserProfileDto,
} from './users.dto';
import { OnboardingGuard } from './guards/onboarding.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaxFileSize } from 'src/common/pipes/maxFilesSizeValidator.pipes';

@ApiTags('Users')
@Controller('users')
export default class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/onboarding')
  async onboard(@Req() req: Request, @Body() body: OnboardingDto) {
    return this.usersService.onboarding((req.user as any).userId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/points')
  async getMyPoints(@Req() req: Request) {
    return this.usersService.getMyPoints((req.user as any).userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseGuards(OnboardingGuard)
  @Get('/profile')
  async getMyProfile(@Req() req: Request) {
    return this.usersService.getUserProfile((req.user as any).userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseGuards(OnboardingGuard)
  @Put('/profile')
  async updateMyProfile(
    @Req() req: Request,
    @Body() body: UpdateUserProfileDto,
  ) {
    return this.usersService.updateUserProfile((req.user as any).userId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post('registration/tryout/submissions')
  async uploadTryoutSubmission(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSize(
            {
              maxSize: 1024 * 1024 * 3,
            },
            1024 * 1024 * 3,
          ),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadTryoutSubmission(
      (req.user as any).userId,
      file,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('registration/tryout/:tryout_id')
  async registerTryout(
    @Req() req: Request,
    @Param('tryout_id') tryoutId: string,
    @Body() body: RegisterTryoutDto,
  ) {
    return this.usersService.registerTryout(
      (req.user as any).userId,
      tryoutId,
      {
        first: body.first_task_submission,
        second: body.second_task_submission,
        third: body.third_task_submission,
      },
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('registration/tryout/:tryout_id')
  async getTryoutRegistration(
    @Req() req: Request,
    @Param('tryout_id') tryoutId: string,
  ) {
    return await this.usersService.getTryoutRegistration(
      (req.user as any).userId,
      tryoutId,
    );
  }
}
