import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { UserClaims } from '@ubi/types';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
/** Route requires no authentication (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_CLAIMS = 'requiredClaims';
/** Caller must hold at least one of the listed claims (any-of). */
export const RequireClaims = (...claims: string[]) => SetMetadata(REQUIRED_CLAIMS, claims);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): UserClaims => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: UserClaims }>();
  if (!req.user) throw new UnauthorizedException();
  return req.user;
});

/** Cross-cutting reads (CEO/VPO) are expressed as a claim, not a bypass. */
export function hasClaim(user: UserClaims, claim: string): boolean {
  return user.claims.includes(claim) || user.claims.includes('role:admin');
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: UserClaims }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('missing bearer token');

    let user: UserClaims;
    try {
      user = await this.jwt.verifyAsync<UserClaims>(token);
    } catch {
      throw new UnauthorizedException('invalid or expired token');
    }
    req.user = user;

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_CLAIMS, targets);
    if (required?.length && !required.some((c) => hasClaim(user, c))) {
      throw new ForbiddenException(`requires one of: ${required.join(', ')}`);
    }
    return true;
  }
}
