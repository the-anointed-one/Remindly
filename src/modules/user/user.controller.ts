import { Controller, Get, Patch, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.userService.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateMe(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    // Stub for future admin use
    return this.userService.findAll(tenantId);
  }
}
