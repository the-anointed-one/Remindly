import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class ConnectLocationDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsOptional()
  locationName?: string;
}

export class UpdateDraftDto {
  @IsString()
  @MinLength(1)
  draftReply: string;
}

export class GenerateReplyDto {
  @IsString()
  @IsOptional()
  tone?: string; // e.g. "professional", "friendly", "apologetic"
}
