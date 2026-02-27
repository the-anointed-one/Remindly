import {
    IsString,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsInt,
    Min,
    IsUUID,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateReminderRuleDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsEnum(ChannelType)
    channel?: ChannelType;

    @IsOptional()
    @IsUUID()
    templateId?: string;

    @IsInt()
    @Min(1)
    offsetMinutes: number; // minutes before appointment to send
}

export class UpdateReminderRuleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(ChannelType)
    channel?: ChannelType;

    @IsOptional()
    @IsUUID()
    templateId?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    offsetMinutes?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
