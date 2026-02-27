import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { Public, CurrentUser } from '../../common/decorators';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @UseGuards(AuthGuard('jwt-refresh'))
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    refreshTokens(
        @CurrentUser('userId') userId: string,
        @CurrentUser('refreshToken') refreshToken: string,
        @Body() _dto: RefreshTokenDto,
    ) {
        return this.authService.refreshTokens(userId, refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@CurrentUser('userId') userId: string) {
        return this.authService.logout(userId);
    }
}
