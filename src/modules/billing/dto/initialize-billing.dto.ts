import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class InitializeBillingDto {
  @IsString()
  @IsNotEmpty()
  plan: string;

  @IsOptional()
  @IsIn(['PAYSTACK', 'PAYPAL', 'CRYPTO'])
  provider?: 'PAYSTACK' | 'PAYPAL' | 'CRYPTO';
}
