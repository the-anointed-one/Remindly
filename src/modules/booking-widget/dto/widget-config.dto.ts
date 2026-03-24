import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsHexColor,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceItemDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(15)
  @Max(480)
  duration: number; // minutes

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class SaveWidgetConfigDto {
  @IsString()
  @MaxLength(120)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  welcomeMessage?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services: ServiceItemDto[];

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays: number[]; // ISO weekday: 1=Mon … 7=Sun

  @IsString()
  workingHoursStart: string; // "HH:mm"

  @IsString()
  workingHoursEnd: string;

  @IsInt()
  @Min(15)
  @Max(240)
  slotDuration: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBookingDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsInt()
  @Min(0)
  serviceIndex: number; // index into widgetConfig.services[]

  @IsString()
  scheduledAt: string; // ISO datetime
}
