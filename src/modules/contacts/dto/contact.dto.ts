import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : [],
  )
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : [],
  )
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  unsubscribed?: boolean;
}

export class ContactQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unsubscribed?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value, 10) || 20, 100))
  limit?: number;
}

export class BulkTagDto {
  @IsArray()
  @IsString({ each: true })
  contactIds: string[];

  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  contactIds: string[];
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class AddMembersDto {
  @IsArray()
  @IsString({ each: true })
  contactIds: string[];
}

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}

export class AssignTagDto {
  @IsString()
  @IsNotEmpty()
  tagId: string;
}
