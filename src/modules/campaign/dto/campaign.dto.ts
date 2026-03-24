import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

// ── Campaign DTOs ─────────────────────────────

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

// ── Audience Segment DTOs ─────────────────────

export class CreateSegmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;
}

export class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;
}

// ── Tag DTOs ─────────────────────────────────

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}

export class AssignTagsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  contactIds: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  tagIds: string[];
}

// ── Campaign Dispatch DTO ─────────────────────

export class DispatchCampaignDto {
  @IsUUID()
  segmentId: string;

  @IsString()
  @MinLength(1)
  messageTemplate: string;

  @IsString()
  channel: string; // SMS | WHATSAPP | EMAIL | VOICE

  @IsString()
  scheduledAt: string; // ISO datetime string
}
