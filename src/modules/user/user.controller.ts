import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.userService.findAll(tenantId);
    }
}
