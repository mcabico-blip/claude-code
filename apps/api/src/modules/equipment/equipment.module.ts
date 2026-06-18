import { Body, Controller, Get, Injectable, Logger, Module, NotFoundException, OnModuleInit, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsArray, IsDateString, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';

/** A scheduled activity that needs machinery — the unit submitted to Omega. */
export interface EquipmentLine {
  activity: string;
  equipment: string;
  qty: number;
  unit: string;
  fromDate: string;
  toDate: string;
}

/** Weekly equipment/machinery schedule — submitted to Omega (OAEC) via API. */
@Entity('equipment_schedule')
export class EquipmentScheduleEntity extends BaseAppEntity {
  @Index() @Column({ name: 'project_id' }) projectId: string;
  @Column({ name: 'week_of', type: 'date' }) weekOf: string;
  @Column({ type: 'jsonb' }) lines: EquipmentLine[];
  @Column({ type: 'varchar', default: 'draft' }) status: 'draft' | 'submitted' | 'pushed';
  @Column({ name: 'prepared_by' }) preparedBy: string;
  /** OAEC reference returned when pushed to Omega. */
  @Column({ name: 'omega_ref', type: 'varchar', nullable: true }) omegaRef: string | null;
  @Column({ name: 'pushed_at', type: 'timestamptz', nullable: true }) pushedAt: Date | null;
}

class CreateDto {
  @IsString() projectId: string;
  @IsDateString() weekOf: string;
  @IsArray() lines: EquipmentLine[];
}

@Injectable()
export class EquipmentService implements OnModuleInit {
  private readonly log = new Logger('Equipment');

  constructor(
    @InjectRepository(EquipmentScheduleEntity) private readonly schedules: Repository<EquipmentScheduleEntity>,
    private readonly config: ConfigService,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'engineering.equipment-schedule', module: 'engineering', title: 'Weekly equipment schedules', description: 'Machinery/activity schedules, with Omega (OAEC) push status.' },
      () => this.schedules.find({ order: { createdAt: 'DESC' }, take: 100 }),
    );
    this.registry.register(
      { key: 'omega.equipment-pushes', module: 'operations', title: 'Equipment schedules pushed to Omega', description: 'OAEC integration log — schedules submitted to the Omega fleet system.' },
      () => this.schedules.find({ where: { status: 'pushed' }, order: { pushedAt: 'DESC' }, take: 100 }),
    );
  }

  list(): Promise<EquipmentScheduleEntity[]> {
    return this.schedules.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  create(user: UserClaims, dto: CreateDto): Promise<EquipmentScheduleEntity> {
    return this.schedules.save(
      this.schedules.create({
        projectId: dto.projectId, weekOf: dto.weekOf, lines: dto.lines,
        status: 'draft', preparedBy: user.email, entity: user.entity, createdBy: user.email,
      }),
    );
  }

  async submit(id: string): Promise<EquipmentScheduleEntity> {
    const s = await this.schedules.findOne({ where: { id } });
    if (!s) throw new NotFoundException('no such schedule');
    s.status = 'submitted';
    return this.schedules.save(s);
  }

  /** Push to Omega's OAEC system over its API; simulate a ref when not configured. */
  async pushToOmega(id: string): Promise<EquipmentScheduleEntity> {
    const s = await this.schedules.findOne({ where: { id } });
    if (!s) throw new NotFoundException('no such schedule');
    const base = this.config.get<string>('OAEC_BASE_URL');
    let omegaRef: string;
    if (base) {
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}/equipment-schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: s.projectId, weekOf: s.weekOf, lines: s.lines, source: 'UBI' }),
        });
        const data = (await res.json()) as { ref?: string };
        omegaRef = data.ref ?? `OAEC-${Date.now()}`;
      } catch (e) {
        this.log.error(`OAEC push failed: ${String(e)}`);
        throw e;
      }
    } else {
      // OAEC not wired yet — record a simulated reference so the flow is visible.
      omegaRef = `OAEC-SIM-${(await this.schedules.count({ where: { status: 'pushed' } })) + 1001}`;
      this.log.warn(`OAEC_BASE_URL not set — simulated push ${omegaRef}`);
    }
    s.status = 'pushed';
    s.omegaRef = omegaRef;
    s.pushedAt = new Date();
    return this.schedules.save(s);
  }

  async seed(user: UserClaims, projectId: string): Promise<void> {
    if ((await this.schedules.count()) > 0) return;
    const today = new Date();
    const wk = new Date(today); wk.setDate(today.getDate() + (6 - today.getDay()));
    const weekOf = wk.toISOString().slice(0, 10);
    const d = (off: number) => { const x = new Date(today); x.setDate(today.getDate() + off); return x.toISOString().slice(0, 10); };
    await this.schedules.save(
      this.schedules.create({
        projectId, weekOf, status: 'draft', preparedBy: 'seed', createdBy: 'seed',
        lines: [
          { activity: 'PCCP pouring STA 4+200–4+600', equipment: 'Transit mixer', qty: 3, unit: 'units', fromDate: d(1), toDate: d(3) },
          { activity: 'Subbase compaction', equipment: 'Vibratory roller', qty: 1, unit: 'unit', fromDate: d(1), toDate: d(5) },
          { activity: 'Hauling aggregates', equipment: 'Dump truck', qty: 4, unit: 'units', fromDate: d(2), toDate: d(6) },
        ],
      }),
    );
  }
}

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly svc: EquipmentService) {}

  @Get('schedules') list(): Promise<EquipmentScheduleEntity[]> { return this.svc.list(); }
  @Post('schedules') create(@CurrentUser() u: UserClaims, @Body() dto: CreateDto): Promise<EquipmentScheduleEntity> { return this.svc.create(u, dto); }
  @Post('schedules/:id/submit') submit(@Param('id') id: string): Promise<EquipmentScheduleEntity> { return this.svc.submit(id); }
  @Post('schedules/:id/push') push(@Param('id') id: string): Promise<EquipmentScheduleEntity> { return this.svc.pushToOmega(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentScheduleEntity])],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
