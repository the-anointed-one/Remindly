import { IsString, MinLength, Matches } from 'class-validator';
import { PASSWORD_REGEX, PASSWORD_MESSAGE } from '../constants/password.constants';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
