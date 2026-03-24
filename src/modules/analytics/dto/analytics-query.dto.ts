import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  excludeDemo?: boolean = true;
}
