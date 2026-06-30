import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(['ADMIN', 'STAFF'])
  role: 'ADMIN' | 'STAFF';
}
