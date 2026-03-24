import { IsString, IsNotEmpty } from 'class-validator';

export class InitializeBillingDto {
  @IsString()
  @IsNotEmpty()
  plan: string;
}
