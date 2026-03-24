import { IsString, IsArray, IsUUID, IsEnum, IsOptional } from 'class-validator';

export class InviteDto {
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];
}

export enum RsvpResponse {
  YES = 'YES',
  NO = 'NO',
  MAYBE = 'MAYBE',
}

export class RespondDto {
  @IsUUID('4')
  contactId: string;

  @IsEnum(RsvpResponse)
  response: RsvpResponse;
}

export class BroadcastDto {
  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
