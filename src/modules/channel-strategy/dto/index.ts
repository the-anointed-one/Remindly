import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelStrategyDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsArray()
  @IsEnum(ChannelType, { each: true })
  chain: ChannelType[];

  @IsOptional()
  @IsBoolean()
  fallbackOnFailed?: boolean;

  @IsOptional()
  @IsBoolean()
  fallbackOnUndelivered?: boolean;

  @IsOptional()
  @IsBoolean()
  fallbackOnUnread?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  unreadWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateChannelStrategyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ChannelType, { each: true })
  chain?: ChannelType[];

  @IsOptional()
  @IsBoolean()
  fallbackOnFailed?: boolean;

  @IsOptional()
  @IsBoolean()
  fallbackOnUndelivered?: boolean;

  @IsOptional()
  @IsBoolean()
  fallbackOnUnread?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  unreadWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
