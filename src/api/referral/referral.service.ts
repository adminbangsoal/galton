import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { DrizzleAsyncProvider } from "src/database/drizzle/drizzle.provider";
import * as schema from 'src/database/schema';
import * as dayjs from 'dayjs';


@Injectable()
export default class ReferralService {
    private readonly logger = new Logger(ReferralService.name);

    constructor(
        @Inject(DrizzleAsyncProvider)
        private db: PostgresJsDatabase<typeof schema>,
    ) { }

    async checkValidReferralCode(code: string, userId: string) {
        const referralCode = await this.db.query.referralCode.findFirst({
            where: eq(schema.referralCode.code, code)
        })

        if (!referralCode) {
            this.logger.error(`Referral code ${code} is not found`);

            throw new NotFoundException(`Kode referral "${code}" tidak ditemukan`);
        }

        if (dayjs().isAfter(referralCode.expiredAt)) {
            this.logger.error(`Referral code ${referralCode.partnerName} is already expired`);

            throw new NotFoundException(`Kode referral "${code}" tidak ditemukan`);
        }

        if (referralCode.isActive === false) {
            this.logger.error(`Referral code ${referralCode.partnerName} is not active`);

            throw new NotFoundException(`Kode referral "${code}" tidak ditemukan`);
        }

        // check if referral code already reached max usage
        const referralUsage = await this.db.query.referralUsage.findMany({
            where: eq(schema.referralUsage.referral_code, referralCode.id)
        })

        if (referralCode.maxUsage && referralUsage.length >= referralCode.maxUsage) {
            this.logger.error(`Referral code ${referralCode.partnerName} is already reached max usage`);

            throw new BadRequestException(`Kode referral "${code}" sudah mencapai batas penggunaan`);
        }

        // check if user already use the referral code
        const isUsedByUser = referralUsage.find(usage => usage.userId === userId);

        return {
            code: referralCode.code,
            partner_name: referralCode.partnerName,
            discount: isUsedByUser ? 0 : referralCode.discount
        }
    }

}