import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApplyReferralCodeDto } from './dto/referral.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('referrals')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /** GET /referrals/stats — code, link, list of referrals, credits earned */
  @Get('stats')
  getStats(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.referralService.getStats(userId, tenantId);
  }

  /** POST /referrals/apply — apply someone else's referral code */
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  applyCode(
    @CurrentUser('userId') userId: string,
    @Body() dto: ApplyReferralCodeDto,
  ) {
    return this.referralService.applyCode(userId, dto);
  }
}
