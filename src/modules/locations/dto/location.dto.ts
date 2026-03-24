import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string; // IANA tz, e.g. "America/New_York"

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
