import { Controller, Get, Global, Injectable, Module, Param, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser, hasClaim } from '../../common/rbac';

/** Shared notification service — approvals, expiries, alerts, ManCom flags. */
@Entity('notification')
export class NotificationEntity extends BaseAppEntity {
  /** Either a direct email or a claim audience like 'role:vpo'. */
  @Index()
  @Column({ name: 'to_audience' })
  toAudience: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column()
  kind: string;

  @Column({ default: false })
  read: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity) private readonly rows: Repository<NotificationEntity>,
  ) {}

  notify(input: { toAudience: string; title: string; body: string; kind: string }): Promise<NotificationEntity> {
    return this.rows.save(this.rows.create({ ...input, createdBy: 'system' }));
  }

  async mine(user: UserClaims): Promise<NotificationEntity[]> {
    const all = await this.rows.find({ where: { read: false }, order: { createdAt: 'DESC' }, take: 100 });
    return all.filter((n) => n.toAudience === user.email || hasClaim(user, n.toAudience));
  }

  async markRead(id: string): Promise<void> {
    await this.rows.update(id, { read: true });
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  mine(@CurrentUser() user: UserClaims): Promise<NotificationEntity[]> {
    return this.svc.mine(user);
  }

  @Post(':id/read')
  async read(@Param('id') id: string): Promise<{ ok: true }> {
    await this.svc.markRead(id);
    return { ok: true };
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
