import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export type TargetType = 'contact' | 'tag' | 'group' | 'segment' | 'campaign';

export class CreateReminderRuleDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  /**
   * Inline message body. Supports template variables:
   *   {{customer_name}}, {{appointment_title}}, {{appointment_time}}, {{appointment_date}}
   * When set, takes priority over templateId.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1600)
  messageTemplate?: string;

  @IsInt()
  @Min(1)
  offsetMinutes: number; // minutes before appointment

  @IsOptional()
  @IsUUID()
  channelStrategyId?: string;

  /**
   * Target type for rule scoping. When set, rule only applies to appointments
   * matching the target. NULL means applies to all appointments.
   */
  @IsOptional()
  @IsIn(['contact', 'tag', 'group', 'segment', 'campaign'])
  targetType?: TargetType;

  /**
   * ID of the target entity (contact, tag, group, segment, or campaign).
   * Required when targetType is set.
   */
  @IsOptional()
  @IsUUID()
  targetId?: string;
}

export class UpdateReminderRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1600)
  messageTemplate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  offsetMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  channelStrategyId?: string;

  @IsOptional()
  @IsIn(['contact', 'tag', 'group', 'segment', 'campaign'])
  targetType?: TargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;
}
