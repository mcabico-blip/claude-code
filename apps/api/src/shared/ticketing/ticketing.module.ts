import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Global,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Column, Entity, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser, Public } from '../../common/rbac';

/** One ticketing engine shared by IT helpdesk AND Admin inquiries. */
@Entity('ticket')
export class TicketEntity extends BaseAppEntity {
  @Column({ type: 'varchar' })
  source: 'it' | 'admin';

  @Column()
  category: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'in-progress' | 'done';

  /** Auto-assign pairs tech location with ticket location (IT spec). */
  @Column()
  location: string;

  @Column({ type: 'varchar', nullable: true })
  assignee: string | null;
}

class CreateTicketDto {
  @IsIn(['it', 'admin']) source: 'it' | 'admin';
  @IsString() @MinLength(2) category: string;
  @IsString() @MinLength(4) title: string;
  @IsString() @MinLength(4) body: string;
  @IsString() @MinLength(2) location: string;
}

class MoveTicketDto {
  @IsIn(['open', 'in-progress', 'done']) status: 'open' | 'in-progress' | 'done';
  @IsOptional() @IsString() assignee?: string;
}

@Injectable()
export class TicketingService {
  constructor(@InjectRepository(TicketEntity) private readonly tickets: Repository<TicketEntity>) {}

  create(user: UserClaims, dto: CreateTicketDto): Promise<TicketEntity> {
    return this.tickets.save(
      this.tickets.create({ ...dto, entity: user.entity, createdBy: user.email }),
    );
  }

  list(source?: 'it' | 'admin'): Promise<TicketEntity[]> {
    return this.tickets.find({
      where: source ? { source } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async move(id: string, dto: MoveTicketDto): Promise<TicketEntity | null> {
    await this.tickets.update(id, { status: dto.status, ...(dto.assignee ? { assignee: dto.assignee } : {}) });
    return this.tickets.findOne({ where: { id } });
  }
}

@Controller('tickets')
export class TicketingController {
  constructor(private readonly svc: TicketingService) {}

  @Post()
  create(@CurrentUser() user: UserClaims, @Body() dto: CreateTicketDto): Promise<TicketEntity> {
    return this.svc.create(user, dto);
  }

  @Get()
  list(@Query('source') source?: 'it' | 'admin'): Promise<TicketEntity[]> {
    return this.svc.list(source);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() dto: MoveTicketDto): Promise<TicketEntity | null> {
    return this.svc.move(id, dto);
  }
}

/* ── Public helpdesk intake — no sign-in, Cloudflare Turnstile instead ── */

class PublicTicketDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(2) category: string;
  @IsString() @MinLength(4) title: string;
  @IsString() @MinLength(4) body: string;
  @IsString() @MinLength(2) location: string;
  @IsOptional() @IsString() turnstileToken?: string;
}

/** Spam brake on top of the captcha: 5 public tickets/min/IP. */
const publicHits = new Map<string, { count: number; resetAt: number }>();
function publicThrottle(ip: string): void {
  const now = Date.now();
  const slot = publicHits.get(ip);
  if (!slot || slot.resetAt < now) {
    publicHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (++slot.count > 5) {
    throw new HttpException('too many tickets — wait a minute', HttpStatus.TOO_MANY_REQUESTS);
  }
}

async function verifyTurnstile(secret: string, token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

@Controller('public/helpdesk')
export class PublicHelpdeskController {
  private readonly log = new Logger('PublicHelpdesk');

  constructor(
    private readonly svc: TicketingService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post()
  async create(@Req() req: Request, @Body() dto: PublicTicketDto): Promise<{ id: string; status: string }> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    publicThrottle(ip);

    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (secret) {
      if (!(await verifyTurnstile(secret, dto.turnstileToken, ip))) {
        throw new ForbiddenException('captcha verification failed');
      }
    } else {
      // Enforced as soon as TURNSTILE_SECRET_KEY is configured (see .env.example).
      this.log.warn('TURNSTILE_SECRET_KEY not set — accepting public ticket without captcha (dev mode)');
    }

    const reporter: UserClaims = {
      sub: 'public',
      email: dto.email ?? 'anonymous',
      name: dto.name,
      entity: 'UBI',
      claims: [],
    };
    const ticket = await this.svc.create(reporter, {
      source: 'it',
      category: dto.category,
      title: dto.title,
      body: `[reporter: ${dto.name} · ${dto.email ?? 'no email'} · ${dto.location}]\n\n${dto.body}`,
      location: dto.location,
    });
    return { id: ticket.id, status: ticket.status };
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity])],
  controllers: [TicketingController, PublicHelpdeskController],
  providers: [TicketingService],
  exports: [TicketingService],
})
export class TicketingModule {}
