import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
  IsUUID,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FormFieldDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsIn(['text', 'email', 'tel', 'textarea', 'select'])
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  placeholder?: string;
}

export class CreateFormDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @IsOptional()
  @IsUUID('4')
  eventId?: string;
}
