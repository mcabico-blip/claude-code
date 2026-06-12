import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotImplementedException,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserClaims } from '@ubi/types';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../common/rbac';
import { AuthService, LoginResult } from './auth.service';

/** Plain in-memory throttle for credential guessing; Redis-backed later. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

function throttle(ip: string): void {
  const now = Date.now();
  const slot = attempts.get(ip);
  if (!slot || slot.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  slot.count += 1;
  if (slot.count > MAX_PER_WINDOW) {
    throw new HttpException('too many login attempts — wait a minute', HttpStatus.TOO_MANY_REQUESTS);
  }
}

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
  login(@Req() req: Request, @Body() dto: LoginDto): Promise<LoginResult> {
    throttle(req.ip ?? req.socket.remoteAddress ?? 'unknown');
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
