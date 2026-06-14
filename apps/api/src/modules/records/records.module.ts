import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  OnModuleInit,
  Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser, hasClaim } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ExpiryService } from '../../shared/expiry/expiry.module';

/** Vehicle registration / insurance / stamps with expiry. */
@Entity('vehicle_doc')
export class VehicleDocEntity extends BaseAppEntity {
  @Index()
  @Column()
  plate: string;

  @Column({ type: 'varchar' })
  kind: 'registration' | 'insurance' | 'stamp';

  @Column({ name: 'ref_no' })
  refNo: string;

  @Column({ name: 'expires_on', type: 'date' })
  expiresOn: string;
}

/** Physical location index — HARD-GATED: sensitive docs (titles) only for
 *  authorized roles. AI-searchable but access-controlled (spec). */
@Entity('physical_location')
export class PhysicalLocationEntity extends BaseAppEntity {
  @Column()
  title: string;

  @Column()
  cabinet: string;

  @Column()
  drawer: string;

  /** Claim required to view, e.g. 'dept:records' or 'role:legal'. */
  @Column({ name: 'requires_claim', type: 'varchar', default: 'dept:records' })
  requiresClaim: string;

  @Column({ default: false })
  sensitive: boolean;
}

class VehicleDocDto {
  @IsString() @MinLength(2) plate: string;
  @IsIn(['registration', 'insurance', 'stamp']) kind: 'registration' | 'insurance' | 'stamp';
  @IsString() @MinLength(2) refNo: string;
  @IsDateString() expiresOn: string;
}

class LocationDto {
  @IsString() @MinLength(2) title: string;
  @IsString() @MinLength(1) cabinet: string;
  @IsString() @MinLength(1) drawer: string;
  @IsOptional() @IsString() requiresClaim?: string;
  @IsOptional() sensitive?: boolean;
}

@Injectable()
export class RecordsService implements OnModuleInit {
  constructor(
    @InjectRepository(VehicleDocEntity) private readonly vdocs: Repository<VehicleDocEntity>,
    @InjectRepository(PhysicalLocationEntity) private readonly locs: Repository<PhysicalLocationEntity>,
    private readonly expiry: ExpiryService,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'records.expiry', module: 'records', title: 'Expiring documents', description: 'Vehicle reg/insurance/stamps + tracked items within 30 days.' },
      () => this.upcoming(),
    );
    this.registry.register(
      {
        key: 'records.physical-index',
        module: 'records',
        title: 'Physical location index',
        description: 'Cabinet/drawer index. Sensitive rows hidden unless caller holds the required claim.',
        requiresClaim: 'dept:records',
      },
      (user) => this.indexFor(user),
    );
  }

  async upcoming(): Promise<Array<{ title: string; kind: string; expiresOn: string; daysLeft: number }>> {
    const now = Date.now();
    const fromVehicles = (await this.vdocs.find()).map((v) => ({
      title: `${v.plate} ${v.kind} (${v.refNo})`,
      kind: v.kind,
      expiresOn: v.expiresOn,
      daysLeft: Math.ceil((new Date(v.expiresOn).getTime() - now) / 86_400_000),
    }));
    const fromEngine = (await this.expiry.upcoming(30)).map((e) => ({
      title: e.title,
      kind: e.kind,
      expiresOn: e.expiresOn,
      daysLeft: Math.ceil((new Date(e.expiresOn).getTime() - now) / 86_400_000),
    }));
    return [...fromVehicles, ...fromEngine]
      .filter((r) => r.daysLeft <= 60)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  async addVehicleDoc(user: UserClaims, dto: VehicleDocDto): Promise<VehicleDocEntity> {
    const saved = await this.vdocs.save(this.vdocs.create({ ...dto, entity: user.entity, createdBy: user.email }));
    // mirror into the shared expiry/reminder engine
    await this.expiry.add({
      kind: `vehicle-${dto.kind}`,
      refModule: 'records',
      title: `${dto.plate} ${dto.kind}`,
      expiresOn: dto.expiresOn,
      notifyAudience: 'dept:records',
    });
    return saved;
  }

  /** Physical index, filtered by what the caller is allowed to see. */
  async indexFor(user: UserClaims): Promise<Array<Record<string, unknown>>> {
    const all = await this.locs.find({ order: { cabinet: 'ASC' } });
    return all.map((l) => {
      const allowed = hasClaim(user, l.requiresClaim);
      return {
        title: allowed ? l.title : '🔒 restricted',
        cabinet: allowed ? l.cabinet : '—',
        drawer: allowed ? l.drawer : '—',
        sensitive: l.sensitive,
        access: allowed ? 'visible' : `needs ${l.requiresClaim}`,
      };
    });
  }

  async addLocation(user: UserClaims, dto: LocationDto): Promise<PhysicalLocationEntity> {
    if (!hasClaim(user, 'dept:records')) throw new ForbiddenException('records staff only');
    return this.locs.save(
      this.locs.create({
        title: dto.title,
        cabinet: dto.cabinet,
        drawer: dto.drawer,
        requiresClaim: dto.requiresClaim ?? 'dept:records',
        sensitive: dto.sensitive ?? false,
        entity: user.entity,
        createdBy: user.email,
      }),
    );
  }

  async seed(creator: string): Promise<void> {
    if ((await this.vdocs.count()) === 0) {
      await this.vdocs.save([
        this.vdocs.create({ plate: 'UBI-DT-114', kind: 'registration', refNo: 'LTO-2025-88421', expiresOn: '2026-06-24', createdBy: creator }),
        this.vdocs.create({ plate: 'UBI-DT-118', kind: 'registration', refNo: 'LTO-2025-88450', expiresOn: '2026-06-27', createdBy: creator }),
        this.vdocs.create({ plate: 'UBI-SV-09', kind: 'insurance', refNo: 'MAA-INS-7741', expiresOn: '2026-06-22', createdBy: creator }),
      ]);
    }
    if ((await this.locs.count()) === 0) {
      await this.locs.save([
        this.locs.create({ title: 'PKG-02 contract & NTP', cabinet: 'Cabinet 1', drawer: 'Drawer A', requiresClaim: 'dept:records', sensitive: false, createdBy: creator }),
        this.locs.create({ title: 'Land Title — HQ lot (TCT-44512)', cabinet: 'Steel Cabinet 3', drawer: 'Drawer B', requiresClaim: 'role:legal', sensitive: true, createdBy: creator }),
        this.locs.create({ title: 'Company SEC registration', cabinet: 'Cabinet 1', drawer: 'Drawer C', requiresClaim: 'dept:records', sensitive: false, createdBy: creator }),
      ]);
    }
  }
}

@Controller('records')
export class RecordsController {
  constructor(private readonly svc: RecordsService) {}

  @Get('expiry')
  expiry(): Promise<unknown> {
    return this.svc.upcoming();
  }

  @Post('vehicle-docs')
  addVehicle(@CurrentUser() user: UserClaims, @Body() dto: VehicleDocDto): Promise<VehicleDocEntity> {
    return this.svc.addVehicleDoc(user, dto);
  }

  @Get('physical-index')
  index(@CurrentUser() user: UserClaims): Promise<unknown> {
    return this.svc.indexFor(user);
  }

  @Post('physical-index')
  addLocation(@CurrentUser() user: UserClaims, @Body() dto: LocationDto): Promise<PhysicalLocationEntity> {
    return this.svc.addLocation(user, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([VehicleDocEntity, PhysicalLocationEntity])],
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
