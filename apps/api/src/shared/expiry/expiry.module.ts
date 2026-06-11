import { Controller, Get, Global, Injectable, Module, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, Entity, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';

/**
 * Shared expiry/renewal reminders — vehicle registration, insurance,
 * licenses/warranties (IT), property docs. Records is the heaviest user.
 */
@Entity('expiry_item')
export class ExpiryItemEntity extends BaseAppEntity {
  @Column()
  kind: string;

  @Column({ name: 'ref_module' })
  refModule: string;

  @Column()
  title: string;

  @Column({ name: 'expires_on', type: 'date' })
  expiresOn: string;

  @Column({ name: 'notify_days_before', type: 'int', default: 15 })
  notifyDaysBefore: number;

  @Column({ name: 'notify_audience', default: 'dept:records' })
  notifyAudience: string;
}

@Injectable()
export class ExpiryService {
  constructor(
    @InjectRepository(ExpiryItemEntity) private readonly rows: Repository<ExpiryItemEntity>,
    private readonly notifications: NotificationsService,
  ) {}

  async upcoming(days: number): Promise<ExpiryItemEntity[]> {
    const all = await this.rows.find({ order: { expiresOn: 'ASC' } });
    const cutoff = Date.now() + days * 86_400_000;
    return all.filter((r) => new Date(r.expiresOn).getTime() <= cutoff);
  }

  add(input: Partial<ExpiryItemEntity> & Pick<ExpiryItemEntity, 'kind' | 'refModule' | 'title' | 'expiresOn'>): Promise<ExpiryItemEntity> {
    return this.rows.save(this.rows.create({ createdBy: 'system', ...input }));
  }

  /** Sweep due reminders into notifications (wire to a cron/queue later). */
  async sweep(): Promise<number> {
    const due = await this.upcoming(0 + 30);
    let sent = 0;
    for (const item of due) {
      const daysLeft = Math.ceil((new Date(item.expiresOn).getTime() - Date.now()) / 86_400_000);
      if (daysLeft <= item.notifyDaysBefore) {
        await this.notifications.notify({
          toAudience: item.notifyAudience,
          title: `${item.kind} expiring: ${item.title}`,
          body: `Expires ${item.expiresOn} (${daysLeft} day(s) left) — ${item.refModule}`,
          kind: 'expiry',
        });
        sent += 1;
      }
    }
    return sent;
  }
}

@Controller('expiry')
export class ExpiryController {
  constructor(private readonly svc: ExpiryService) {}

  @Get('upcoming')
  upcoming(@Query('days') days?: string): Promise<ExpiryItemEntity[]> {
    return this.svc.upcoming(Number(days ?? 30));
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ExpiryItemEntity]), NotificationsModule],
  controllers: [ExpiryController],
  providers: [ExpiryService],
  exports: [ExpiryService],
})
export class ExpiryModule {}
