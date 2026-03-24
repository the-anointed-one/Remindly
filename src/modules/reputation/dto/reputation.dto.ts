import { IsString, IsOptional, IsInt } from 'class-validator';

export class SendFeedbackRequestDto {
  @IsString()
  appointmentId: string;
}

export class GetResponsesDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;
}
