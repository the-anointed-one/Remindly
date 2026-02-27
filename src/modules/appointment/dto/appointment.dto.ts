import {
    IsString,
    IsUUID,
    IsDateString,
    IsOptional,
    IsInt,
    Min,
    IsEnum,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
    @IsUUID()
    customerId: string;

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
}

export class UpdateAppointmentDto {
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
