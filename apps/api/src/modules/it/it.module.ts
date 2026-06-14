import { Body, Controller, Get, Injectable, Module, OnModuleInit, Post } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { PropertyModule } from '../property/property.module';
import { PropertyService } from '../property/property.module';

/** SNMP-monitored device (UPS, switch, NVR, firewall). */
@Entity('it_device')
export class DeviceEntity extends BaseAppEntity {
  @Column() name: string;
  @Column() kind: string;
  @Column() ip: string;
  @Column({ type: 'varchar', default: 'up' }) status: 'up' | 'warn' | 'down';
  @Column({ name: 'detail', type: 'varchar', nullable: true }) detail: string | null;
}

/** Quarterly preventive-maintenance schedule, auto-built from Property assets. */
@Entity('it_pms')
export class PmsEntity extends BaseAppEntity {
  @Index() @Column({ name: 'asset_qr' }) assetQr: string;
  @Column() assetType: string;
  @Column() quarter: string; // e.g. 2026-Q2
  @Column({ name: 'due_on', type: 'date' }) dueOn: string;
  @Column({ type: 'varchar', default: 'scheduled' }) status: 'scheduled' | 'done';
}

/** DeskGuard v2 — self-reporting productivity (client-side OCR/counts posted). */
@Entity('deskguard_entry')
export class DeskguardEntity extends BaseAppEntity {
  @Index() @Column() person: string;
  @Column() topApp: string;
  @Column({ name: 'kpi_activity' }) kpiActivity: string;
  @Column({ name: 'keystrokes', type: 'int', default: 0 }) keystrokes: number;
  @Column({ name: 'mouse', type: 'int', default: 0 }) mouse: number;
  @Column({ name: 'active_minutes', type: 'int', default: 0 }) activeMinutes: number;
  @Column({ type: 'date' }) day: string;
}

/** Server-room / ambient temperature (DHT22+ESP32 or SNMP/IPMI). */
@Entity('env_reading')
export class EnvReadingEntity extends BaseAppEntity {
  @Column() sensor: string;
  @Column({ name: 'temp_c', type: 'real' }) tempC: number;
  @Column({ type: 'real', nullable: true }) humidity: number | null;
}

export const DESKGUARD_CONSENT =
  'Activity capture is for OFFICIAL USE on company-owned assets only. ' +
  'Avoid personal activity on company devices. Captured data is role-scoped.';

class DeviceDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) kind: string;
  @IsString() @MinLength(2) ip: string;
}
class DeskguardDto {
  @IsString() person: string;
  @IsString() topApp: string;
  @IsString() kpiActivity: string;
  @IsOptional() @IsInt() keystrokes?: number;
  @IsOptional() @IsInt() mouse?: number;
  @IsOptional() @IsInt() activeMinutes?: number;
}

@Injectable()
export class ItService implements OnModuleInit {
  constructor(
    @InjectRepository(DeviceEntity) private readonly devices: Repository<DeviceEntity>,
    @InjectRepository(PmsEntity) private readonly pms: Repository<PmsEntity>,
    @InjectRepository(DeskguardEntity) private readonly desk: Repository<DeskguardEntity>,
    @InjectRepository(EnvReadingEntity) private readonly env: Repository<EnvReadingEntity>,
    private readonly property: PropertyService,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'it.capacity', module: 'it', title: 'Capacity planning & controls', description: 'Resource headroom + projected breach dates.' },
      () => this.capacity(),
    );
    this.registry.register(
      { key: 'it.devices', module: 'it', title: 'Monitored devices (SNMP)', description: 'UPS/switch/NVR/firewall status.' },
      () => this.devices.find({ order: { kind: 'ASC' } }),
    );
    this.registry.register(
      { key: 'it.pms', module: 'it', title: 'Preventive maintenance schedule', description: 'Quarterly PMS auto-built from active Property assets.' },
      () => this.pms.find({ order: { dueOn: 'ASC' }, take: 200 }),
    );
    this.registry.register(
      { key: 'it.deskguard', module: 'it', title: 'DeskGuard activity (self-report)', description: 'Top apps / KPI hours; official-use-only, role-scoped.' },
      () => this.desk.find({ order: { createdAt: 'DESC' }, take: 100 }),
    );
    this.registry.register(
      { key: 'it.env', module: 'it', title: 'Environmental monitoring', description: 'Server-room + ambient temperature/humidity.' },
      () => this.env.find({ order: { createdAt: 'DESC' }, take: 50 }),
    );
  }

  /** Stub capacity figures (the box) — real SNMP/df feed lands later. */
  capacity(): Array<Record<string, unknown>> {
    return [
      { resource: 'Storage (320 GB SSD)', usedPct: 41, trend: 'rising', projectedBreach: '2027-02', status: 'green' },
      { resource: 'Data transfer (6 TB/mo)', usedPct: 22, trend: 'stable', projectedBreach: null, status: 'green' },
      { resource: 'Postgres size', usedPct: 18, trend: 'rising', projectedBreach: null, status: 'green' },
      { resource: 'UPS load vs rated', usedPct: 63, trend: 'stable', projectedBreach: null, status: 'amber' },
    ];
  }

  listDevices(): Promise<DeviceEntity[]> { return this.devices.find({ order: { kind: 'ASC' } }); }
  listPms(): Promise<PmsEntity[]> { return this.pms.find({ order: { dueOn: 'ASC' }, take: 200 }); }
  listEnv(): Promise<EnvReadingEntity[]> { return this.env.find({ order: { createdAt: 'DESC' }, take: 50 }); }
  listDeskguard(): Promise<DeskguardEntity[]> { return this.desk.find({ order: { createdAt: 'DESC' }, take: 100 }); }

  addDevice(user: UserClaims, dto: DeviceDto): Promise<DeviceEntity> {
    return this.devices.save(this.devices.create({ ...dto, status: 'up', createdBy: user.email }));
  }

  /** Auto-generate quarterly PMS from active Property assets (idempotent/quarter). */
  async generatePms(user: UserClaims): Promise<{ created: number; quarter: string }> {
    const now = new Date();
    const q = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    const assets = await this.property.pmsEligible();
    let created = 0;
    for (const a of assets) {
      const exists = await this.pms.findOne({ where: { assetQr: a.qr, quarter: q } });
      if (exists) continue;
      const due = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 2, 28);
      await this.pms.save(
        this.pms.create({
          assetQr: a.qr, assetType: a.type, quarter: q,
          dueOn: due.toISOString().slice(0, 10), status: 'scheduled', createdBy: user?.email ?? 'system',
        }),
      );
      created += 1;
    }
    return { created, quarter: q };
  }

  postDeskguard(user: UserClaims, dto: DeskguardDto): Promise<DeskguardEntity> {
    return this.desk.save(
      this.desk.create({
        person: dto.person, topApp: dto.topApp, kpiActivity: dto.kpiActivity,
        keystrokes: dto.keystrokes ?? 0, mouse: dto.mouse ?? 0, activeMinutes: dto.activeMinutes ?? 0,
        day: new Date().toISOString().slice(0, 10), createdBy: user.email,
      }),
    );
  }

  async seed(user: UserClaims): Promise<void> {
    if ((await this.devices.count()) === 0) {
      await this.devices.save([
        this.devices.create({ name: 'APC UPS — server room', kind: 'UPS', ip: '10.0.0.11', status: 'up', detail: 'load 63%, runtime 22m', createdBy: 'seed' }),
        this.devices.create({ name: 'H3C core switch', kind: 'Switch', ip: '10.0.0.1', status: 'up', detail: '48 ports, 31 active', createdBy: 'seed' }),
        this.devices.create({ name: 'Hikvision NVR', kind: 'NVR', ip: '10.0.0.30', status: 'warn', detail: '1 camera offline (CAM-IT-01)', createdBy: 'seed' }),
        this.devices.create({ name: 'Sangfor NGAF', kind: 'Firewall', ip: '10.0.0.2', status: 'up', detail: 'threats blocked 24h: 142', createdBy: 'seed' }),
      ]);
    }
    if ((await this.env.count()) === 0) {
      await this.env.save([
        this.env.create({ sensor: 'Server room (DHT22-1)', tempC: 23.4, humidity: 51, createdBy: 'seed' }),
        this.env.create({ sensor: 'Server room (IPMI)', tempC: 24.1, humidity: null, createdBy: 'seed' }),
      ]);
    }
    if ((await this.desk.count()) === 0) {
      await this.desk.save([
        this.desk.create({ person: 'Encoder — Cruz', topApp: 'Acumatica', kpiActivity: 'DR encoding', keystrokes: 14200, mouse: 3100, activeMinutes: 372, day: new Date().toISOString().slice(0, 10), createdBy: 'seed' }),
      ]);
    }
    await this.generatePms(user);
  }
}

@Controller('it')
export class ItController {
  constructor(private readonly svc: ItService) {}

  @Get('capacity') capacity(): unknown { return this.svc.capacity(); }
  @Get('devices') devices(): Promise<DeviceEntity[]> { return this.svc.listDevices(); }
  @Get('pms') pmsList(): Promise<PmsEntity[]> { return this.svc.listPms(); }
  @Get('env') env(): Promise<EnvReadingEntity[]> { return this.svc.listEnv(); }
  @Get('deskguard/policy') policy(): { consent: string } { return { consent: DESKGUARD_CONSENT }; }
  @Get('deskguard') deskguard(): Promise<DeskguardEntity[]> { return this.svc.listDeskguard(); }

  @Post('devices') addDevice(@CurrentUser() u: UserClaims, @Body() dto: DeviceDto): Promise<DeviceEntity> { return this.svc.addDevice(u, dto); }
  @Post('pms/generate') gen(@CurrentUser() u: UserClaims): Promise<{ created: number; quarter: string }> { return this.svc.generatePms(u); }
  @Post('deskguard') post(@CurrentUser() u: UserClaims, @Body() dto: DeskguardDto): Promise<DeskguardEntity> { return this.svc.postDeskguard(u, dto); }
}

@Module({
  imports: [TypeOrmModule.forFeature([DeviceEntity, PmsEntity, DeskguardEntity, EnvReadingEntity]), PropertyModule],
  controllers: [ItController],
  providers: [ItService],
  exports: [ItService],
})
export class ItModule {}
