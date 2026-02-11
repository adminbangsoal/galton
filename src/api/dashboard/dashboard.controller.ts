import {
  Controller,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import { DashboardService } from './dashboard.service';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('headers')
  async getDashboardHeaders(@Req() req: Request) {
    const userId: string = (req.user as any).userId;
    return this.dashboardService.getDashboardHeaders(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('')
  async getDashboard(@Req() req: Request) {
    const userId: string = (req.user as any).userId;
    return this.dashboardService.getDashboard(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getDashboardProfile(@Req() req: Request) {
    const userId: string = (req.user as any).userId;
    return this.dashboardService.getDashboardProfile(userId);
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
  @Post('profile-picture')
  async uploadProfilePicture(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1024 * 1024 * 10,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const userId: string = (req.user as any).userId;
    return this.dashboardService.uploadProfilePicture(file, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/rank')
  async getMobileDashboardRank(@Req() req: Request) {
    return await this.dashboardService.getMobileDashboardRank(
      (req.user as any).userId,
    ); 
  }

}
