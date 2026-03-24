import { IsString, Length, Matches } from 'class-validator';

export class ApplyReferralCodeDto {
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Referral code must be 8 uppercase alphanumeric characters',
  })
  code: string;
}
