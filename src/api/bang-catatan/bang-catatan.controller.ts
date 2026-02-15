import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../authentication/guard/jwt.guard';
import {
  CreateBangCatatanDTO,
  GetCatatanTimelineDTO,
  ReportCatatanDTO,
} from './bang-catatan.dto';
import BangCatatanService from './bang-catatan.service';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/s3/s3.service';

@ApiTags('Bang Catatan')
@Controller('catatan')
class BangCatatanController {
  constructor(
    private readonly bangCatatanService: BangCatatanService,
    private readonly s3Service: S3Service,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('')
  async getCatatanTimeline(
    @Req() req: Request,
    @Query() pageOptionsDto: GetCatatanTimelineDTO,
  ) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.getCatatanTimeline(
      pageOptionsDto,
      userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('')
  async createCatatan(
    @Body() createCatatan: CreateBangCatatanDTO,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.createCatatan(createCatatan, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/media')
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
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
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId as string;
    const fileName = file.originalname.replace(/\s+/g, '_'); // replace whitespaces with underscores
    const filePath = `bangcatatan/${userId}-${fileName}`;

    const res = await this.s3Service.uploadFile(file, filePath);

    return {
      url: res.url,
      key: res.key,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/:id')
  async getCatatan(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.getCatatan(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('/:id')
  async deleteCatatan(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.deleteCatatan(id, userId);
  }

  @Get('/:id/like-count')
  async getCatatanLikeCount(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.getCatatanLikeCount(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/:id/download')
  async downloadCatatan(@Param('id') id: string) {
    return await this.bangCatatanService.downloadCatatan(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('/:id/like')
  async likeCatatan(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.likeCatatan(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('/:id/like')
  async unlikeCatatan(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.unlikeCatatan(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/:id/report')
  async reportCatatan(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() reportCatatan: ReportCatatanDTO,
  ) {
    const userId = (req.user as any).userId as string;
    return await this.bangCatatanService.reportCatatan(
      id,
      userId,
      reportCatatan,
    );
  }
}

export default BangCatatanController;
