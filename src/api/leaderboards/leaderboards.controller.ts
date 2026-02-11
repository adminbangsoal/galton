import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboards.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import { Request } from 'express';

@ApiTags('Leaderboards')
@Controller('leaderboards')
export default class LeaderdboardsController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('/')
  async getLeaderboard() {
    return this.leaderboardService.getLeaderboard();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/my-rank')
  async getMyRank(@Req() req: Request) {
    return this.leaderboardService.getMyRank((req.user as any).userId);
  }

  @Post('/backup-leaderboard')
  async backupLeaderboard() {
    return this.leaderboardService.backupLeaderboard();
  }

  @Get('ptn')
  async getPtnRank() {
    return this.leaderboardService.getPtnRank();
  }
}
