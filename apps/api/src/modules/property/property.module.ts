import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';

export type AssetStatus = 'in-use' | 'idle' | 'maintenance' | 'retired';

/** QR-based lightweight EAM — who holds what, where, in what state. */
@Entity('asset')
export class AssetEntity extends BaseAppEntity {
  @Index({ unique: true })
  @Column()
  qr: string;

  @Column()
  type: string;

  /** Coarse category for PMS selection, e.g. "Heavy equipment", "IT equipment". */
  @Column({ default: 'General' })
  category: string;

  @Column({ type: 'varchar', default: 'idle' })
  status: AssetStatus;

  @Column()
  location: string;

  @Column()
  custodian: string;

  @Column({ name: 'custodian_email', type: 'varchar', nullable: true })
  custodianEmail: string | null;

  /** Active assets feed the IT PMS scheduler (quarterly maintenance). */
  @Column({ name: 'pms_eligible', default: true })
  pmsEligible: boolean;
}

@Entity('asset_movement')
export class AssetMovementEntity extends BaseAppEntity {
  @Index()
  @Column({ name: 'asset_id' })
  assetId: string;

  @Column({ type: 'varchar' })
  kind: 'scan' | 'issue' | 'return' | 'status' | 'create';

  @Column({ type: 'varchar', nullable: true })
  fromCustodian: string | null;

  @Column({ type: 'varchar', nullable: true })
  toCustodian: string | null;

  @Column()
  location: string;

  @Column({ type: 'varchar' })
  status: AssetStatus;

  @Column()
  by: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;
}

/** Monthly custodian attestation — each custodian confirms what they hold. */
@Entity('custodian_attestation')
export class CustodianAttestationEntity extends BaseAppEntity {
  @Index()
  @Column({ name: 'asset_id' })
  assetId: string;

  @Column()
  custodian: string;

  /** YYYY-MM */
  @Column()
  month: string;

  @Column({ default: true })
  confirmed: boolean;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column()
  by: string;
}

class ScanDto {
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(['in-use', 'idle', 'maintenance', 'retired']) status?: AssetStatus;
  @IsOptional() @IsString() custodian?: string;
  @IsOptional() @IsString() note?: string;
}

class AttestDto {
  @IsString() @MinLength(7) month: string;
  @IsOptional() @IsString() note?: string;
}

@Injectable()
export class PropertyService implements OnModuleInit {
  constructor(
    @InjectRepository(AssetEntity) private readonly assets: Repository<AssetEntity>,
    @InjectRepository(AssetMovementEntity) private readonly moves: Repository<AssetMovementEntity>,
    @InjectRepository(CustodianAttestationEntity) private readonly attests: Repository<CustodianAttestationEntity>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'property.assets', module: 'property', title: 'Asset custody (QR EAM)', description: 'Who holds what; QR scans update location/status/custodian.' },
      () => this.assets.find({ order: { qr: 'ASC' } }),
    );
    this.registry.register(
      { key: 'property.attestations', module: 'property', title: 'Monthly custodian attestations', description: 'Each custodian confirms equipment issued to them — audit trail.' },
      () => this.attests.find({ order: { createdAt: 'DESC' }, take: 100 }),
    );
  }

  list(): Promise<AssetEntity[]> {
    return this.assets.find({ order: { qr: 'ASC' } });
  }

  async byQr(qr: string): Promise<AssetEntity> {
    const a = await this.assets.findOne({ where: { qr } });
    if (!a) throw new NotFoundException(`no asset ${qr}`);
    return a;
  }

  async history(assetId: string): Promise<AssetMovementEntity[]> {
    return this.moves.find({ where: { assetId }, order: { createdAt: 'DESC' } });
  }

  /** Mobile scans a QR → log location/status/custodian change. */
  async scan(user: UserClaims, qr: string, dto: ScanDto): Promise<AssetEntity> {
    const a = await this.byQr(qr);
    const fromCustodian = a.custodian;
    if (dto.location) a.location = dto.location;
    if (dto.status) a.status = dto.status;
    if (dto.custodian) {
      a.custodian = dto.custodian;
      a.custodianEmail = null;
    }
    const saved = await this.assets.save(a);
    await this.moves.save(
      this.moves.create({
        assetId: a.id,
        kind: dto.custodian ? 'issue' : 'scan',
        fromCustodian,
        toCustodian: dto.custodian ?? fromCustodian,
        location: a.location,
        status: a.status,
        by: user.email,
        note: dto.note ?? null,
        entity: a.entity,
        createdBy: user.email,
      }),
    );
    return saved;
  }

  async attest(user: UserClaims, qr: string, dto: AttestDto): Promise<CustodianAttestationEntity> {
    const a = await this.byQr(qr);
    return this.attests.save(
      this.attests.create({
        assetId: a.id,
        custodian: a.custodian,
        month: dto.month,
        confirmed: true,
        note: dto.note ?? null,
        by: user.email,
        entity: a.entity,
        createdBy: user.email,
      }),
    );
  }

  attestations(): Promise<CustodianAttestationEntity[]> {
    return this.attests.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  /** Active, PMS-eligible assets — consumed by the IT PMS scheduler. */
  pmsEligible(): Promise<AssetEntity[]> {
    return this.assets.find({ where: { pmsEligible: true } });
  }

  /** Distinct categories among PMS-eligible assets (for the scheduler picker). */
  async categories(): Promise<Array<{ category: string; count: number }>> {
    const rows = await this.assets.find({ where: { pmsEligible: true } });
    const map = new Map<string, number>();
    for (const a of rows) map.set(a.category, (map.get(a.category) ?? 0) + 1);
    return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category));
  }

  pmsEligibleByCategories(categories: string[]): Promise<AssetEntity[]> {
    return this.assets.find({ where: { pmsEligible: true } }).then((rows) =>
      categories.length ? rows.filter((a) => categories.includes(a.category)) : rows,
    );
  }

  async seed(creator: string): Promise<void> {
    if ((await this.assets.count()) > 0) return;
    const rows: Array<Partial<AssetEntity>> = [
      { qr: 'AST-00112', type: 'Total station (Leica TS07)', category: 'Survey equipment', status: 'in-use', location: 'PKG-02 site office', custodian: 'Survey — Reyes' },
      { qr: 'AST-00387', type: 'Plate compactor', category: 'Heavy equipment', status: 'in-use', location: 'PKG-05', custodian: 'PKG-05 warehouse' },
      { qr: 'AST-00421', type: 'Laptop (Dell 5440)', category: 'IT equipment', status: 'in-use', location: 'HQ 3F Engineering', custodian: 'Engr. dela Cruz' },
      { qr: 'AST-00455', type: 'Concrete vibrator', category: 'Heavy equipment', status: 'maintenance', location: 'HQ motor pool', custodian: 'Property warehouse' },
      { qr: 'AST-00501', type: 'Generator 10kVA', category: 'Power equipment', status: 'idle', location: 'PKG-11 yard', custodian: 'PKG-11 warehouse' },
      { qr: 'AST-00540', type: 'Desktop + UPS (admin)', category: 'IT equipment', status: 'in-use', location: 'HQ 2F Admin', custodian: 'Admin — Flores' },
      { qr: 'AST-00566', type: 'Backhoe loader', category: 'Heavy equipment', status: 'in-use', location: 'PKG-05', custodian: 'PKG-05 motor pool' },
    ];
    for (const r of rows) {
      const a = await this.assets.save(this.assets.create({ ...r, createdBy: creator }));
      await this.moves.save(
        this.moves.create({
          assetId: a.id, kind: 'create', fromCustodian: null, toCustodian: a.custodian,
          location: a.location, status: a.status, by: creator, note: 'labeled + registered', createdBy: creator,
        }),
      );
    }
  }
}

@Controller('property')
export class PropertyController {
  constructor(private readonly svc: PropertyService) {}

  @Get('assets')
  list(): Promise<AssetEntity[]> {
    return this.svc.list();
  }

  @Get('assets/:qr')
  async one(@Param('qr') qr: string): Promise<{ asset: AssetEntity; history: AssetMovementEntity[] }> {
    const asset = await this.svc.byQr(qr);
    return { asset, history: await this.svc.history(asset.id) };
  }

  @Post('assets/:qr/scan')
  scan(@CurrentUser() user: UserClaims, @Param('qr') qr: string, @Body() dto: ScanDto): Promise<AssetEntity> {
    return this.svc.scan(user, qr, dto);
  }

  @Post('assets/:qr/attest')
  attest(@CurrentUser() user: UserClaims, @Param('qr') qr: string, @Body() dto: AttestDto): Promise<CustodianAttestationEntity> {
    return this.svc.attest(user, qr, dto);
  }

  @Get('attestations')
  attestations(): Promise<CustodianAttestationEntity[]> {
    return this.svc.attestations();
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([AssetEntity, AssetMovementEntity, CustodianAttestationEntity])],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
