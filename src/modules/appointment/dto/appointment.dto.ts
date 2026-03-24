import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { AppointmentStatus, ChannelType, TargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class ReminderConfigDto {
  @IsEnum(ChannelType)
  channel: ChannelType;

  @IsString()
  template: string;
}

export class CreateAppointmentDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  audienceSegmentId?: string;

  @IsString()
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderConfigDto)
  reminderConfig?: ReminderConfigDto;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
