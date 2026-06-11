import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface LoginResult {
  token: string;
  user: UserClaims;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  toClaims(u: UserEntity): UserClaims {
    return { sub: u.id, email: u.email, name: u.name, entity: u.entity, claims: u.claims };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('bad credentials');
    }
    const claims = this.toClaims(user);
    // Offline-cached-login policy: field roles get the long grace window.
    const expiresIn = user.isField
      ? this.config.get<string>('JWT_EXPIRES_FIELD', '72h')
      : this.config.get<string>('JWT_EXPIRES', '8h');
    const token = await this.jwt.signAsync(
      { ...claims },
      { expiresIn: expiresIn as JwtSignOptions['expiresIn'] },
    );
    return { token, user: claims };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async ensureUser(input: {
    email: string;
    name: string;
    password?: string;
    claims: string[];
    isField?: boolean;
    entity?: 'UBI' | 'OMEGA';
  }): Promise<UserEntity> {
    const existing = await this.findByEmail(input.email);
    if (existing) return existing;
    const user = this.users.create({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.password ? await bcrypt.hash(input.password, 10) : null,
      claims: input.claims,
      isField: input.isField ?? false,
      entity: input.entity ?? 'UBI',
      createdBy: 'seed',
    });
    return this.users.save(user);
  }
}
