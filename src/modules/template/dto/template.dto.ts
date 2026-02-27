import {
    IsString,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsArray,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateTemplateDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsEnum(ChannelType)
    channel?: ChannelType;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsString()
    body: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variables?: string[];
}

export class UpdateTemplateDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(ChannelType)
    channel?: ChannelType;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsString()
    body?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variables?: string[];

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
