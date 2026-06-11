import { Body, Controller, Get, HttpCode, NotImplementedException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserClaims } from '@ubi/types';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser, Public } from '../../common/rbac';
import { AuthService, LoginResult } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(4)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: UserClaims): UserClaims {
    return user;
  }

  /** Sign in with Google — optional layer on standalone auth (Pillar 1). */
  @Public()
  @Get('google')
  google(): never {
    if (!this.config.get('GOOGLE_CLIENT_ID')) {
      throw new NotImplementedException('Google OAuth not configured (set GOOGLE_CLIENT_ID/SECRET)');
    }
    throw new NotImplementedException('Google OAuth flow lands in pillar-auth follow-up');
  }
}
