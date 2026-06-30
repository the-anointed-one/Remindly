import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEnum(['ADMIN', 'STAFF'])
  role: 'ADMIN' | 'STAFF';
}
