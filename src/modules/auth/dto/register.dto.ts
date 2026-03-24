import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { PASSWORD_REGEX, PASSWORD_MESSAGE } from '../constants/password.constants';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsString()
  tenantName: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
