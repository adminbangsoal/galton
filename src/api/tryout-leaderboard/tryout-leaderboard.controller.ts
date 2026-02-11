import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import TryoutLeaderboardService from './tryout-leaderboard.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import { TuringGuard } from 'src/authentication/guard/turing.guard';

@ApiTags('Tryout Leaderboard')
@Controller('tryout-leaderboard')
export class TryoutLeaderboardController {
  constructor(private readonly tryoutLeaderboardService: TryoutLeaderboardService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/:tryout_id')
  async getLeaderboard(
    @Param('tryout_id') tryout_id: string,
  ) {
    return this.tryoutLeaderboardService.getLeaderboard(tryout_id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/:tryout_id/my-rank')
  async getMyRank(
    @Param('tryout_id') tryout_id: string,
    @Req() req: Request
  ) {
    return this.tryoutLeaderboardService.getMyRank(tryout_id, (req.user as any).userId);
  }
}