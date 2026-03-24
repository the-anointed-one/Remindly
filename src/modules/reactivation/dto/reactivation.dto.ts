import { IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(7)
  inactivityDays?: number;

  @IsOptional()
  @IsString()
  discountOffer?: string;

  @IsString()
  messageTemplate: string;

  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(7)
  inactivityDays?: number;

  @IsOptional()
  @IsString()
  discountOffer?: string;

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;

  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'COMPLETED'])
  status?: string;
}
