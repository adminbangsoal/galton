import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import ReferralService from "./referral.service";
import { JwtAuthGuard } from "src/authentication/guard/jwt.guard";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

@ApiTags('Referral')
@Controller('referral')
export default class ReferralController {
    constructor(
        private readonly referralService: ReferralService
    ) { }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('/:code')
    async checkValidReferralCode(@Param('code') code: string, @Req() req: Request) {
        const user = req.user as any;
        return this.referralService.checkValidReferralCode(code, user.userId);
    }
}