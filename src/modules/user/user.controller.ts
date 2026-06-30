import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators';
import { UpdateUserDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Self ──────────────────────────────────

  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.userService.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateMe(userId, dto);
  }

  // ── Team management ───────────────────────

  @Get('members')
  listMembers(@CurrentUser('tenantId') tenantId: string) {
    return this.userService.listMembers(tenantId);
  }

  @Post('members/invite')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  inviteMember(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.userService.inviteMember(tenantId, userId, role, dto);
  }

  @Patch('members/:id/role')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  updateMemberRole(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: string,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.userService.updateMemberRole(tenantId, role, memberId, dto);
  }

  @Delete('members/:id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  removeMember(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') memberId: string,
  ) {
    return this.userService.removeMember(tenantId, userId, role, memberId);
  }
}
