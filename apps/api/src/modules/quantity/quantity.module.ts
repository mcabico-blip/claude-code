import { Body, Controller, Get, Injectable, Module, OnModuleInit, Post, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { QuantityRollup, UserClaims } from '@ubi/types';
import { IsNumber as _N, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ProjectEntity } from '../engineering/entities';

/** Weekly accomplishment by a QE onsite — auto-rolls into the monthly report. */
@Entity('quantity_entry')
export class QuantityEntryEntity extends BaseAppEntity {
  @Index() @Column({ name: 'project_id' }) projectId: string;
  @Column({ name: 'week_of', type: 'date' }) weekOf: string;
  @Column({ type: 'double precision' }) amount: number;
  @Column({ name: 'entered_by' }) enteredBy: string;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
}

/** Monthly projected ₱ accomplishment (gdrive replacement, top row). */
@Entity('month_projection')
export class MonthProjectionEntity extends BaseAppEntity {
  @Index() @Column({ name: 'project_id' }) projectId: string;
  @Column() month: string; // YYYY-MM
  @Column({ name: 'projected_amount', type: 'double precision', default: 0 }) projectedAmount: number;
}

/** Monthly material requirement per project (gdrive replacement, material rows). */
@Entity('material_req')
export class MaterialReqEntity extends BaseAppEntity {
  @Index() @Column({ name: 'project_id' }) projectId: string;
  @Column() month: string;
  @Column() material: string;
  @Column() unit: string;
  @Column({ type: 'double precision', default: 0 }) qty: number;
}

class EntryDto {
  @IsString() projectId: string;
  @IsString() weekOf: string;
  @_N() amount: number;
  @IsOptional() @IsString() note?: string;
}
class ProjectionDto {
  @IsString() projectId: string;
  @IsString() @MinLength(7) month: string;
  @_N() projectedAmount: number;
}
class MaterialDto {
  @IsString() projectId: string;
  @IsString() @MinLength(7) month: string;
  @IsString() material: string;
  @IsString() unit: string;
  @_N() qty: number;
}

@Injectable()
export class QuantityService implements OnModuleInit {
  constructor(
    @InjectRepository(QuantityEntryEntity) private readonly entries: Repository<QuantityEntryEntity>,
    @InjectRepository(MonthProjectionEntity) private readonly projections: Repository<MonthProjectionEntity>,
    @InjectRepository(MaterialReqEntity) private readonly materials: Repository<MaterialReqEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      { key: 'engineering.quantity', module: 'engineering', title: 'Quantity — accomplishment rollup', description: 'Weekly QE entries rolled to per-project to-date %, this-month, slippage.' },
      () => this.rollup(),
    );
    this.registry.register(
      { key: 'engineering.material-reqs', module: 'engineering', title: 'Monthly material requirements', description: 'Projected materials per project per month — feeds Procurement.' },
      () => this.materials.find({ order: { month: 'ASC' }, take: 500 }),
    );
  }

  private ym(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async rollup(): Promise<QuantityRollup[]> {
    const projects = await this.projects.find({ order: { code: 'ASC' } });
    const allEntries = await this.entries.find();
    const thisMonth = this.ym(new Date());
    return projects.map((p) => {
      const mine = allEntries.filter((e) => e.projectId === p.id);
      const sum = mine.reduce((s, e) => s + Number(e.amount), 0);
      const toDate = Number(p.priorAccomplished) + sum;
      const monthSum = mine.filter((e) => this.ym(new Date(e.weekOf)) === thisMonth).reduce((s, e) => s + Number(e.amount), 0);
      const last = mine.sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0];
      const inhouse = Number(p.inhouseAmount) || 0;
      return {
        projectId: p.id,
        code: p.code,
        name: p.name,
        pe: p.pe,
        inhouseAmount: inhouse,
        priorAccomplished: Number(p.priorAccomplished),
        toDate,
        pct: inhouse ? toDate / inhouse : 0,
        thisMonth: monthSum,
        lastWeekOf: last?.weekOf ?? null,
        entity: p.entity,
      };
    });
  }

  async headSummary(): Promise<{
    projects: number;
    totalInhouse: number;
    totalToDate: number;
    overallPct: number;
    thisMonth: number;
    behind: number;
    rows: QuantityRollup[];
  }> {
    const rows = await this.rollup();
    const totalInhouse = rows.reduce((s, r) => s + r.inhouseAmount, 0);
    const totalToDate = rows.reduce((s, r) => s + r.toDate, 0);
    const thisMonth = rows.reduce((s, r) => s + r.thisMonth, 0);
    return {
      projects: rows.length,
      totalInhouse,
      totalToDate,
      overallPct: totalInhouse ? totalToDate / totalInhouse : 0,
      thisMonth,
      behind: rows.filter((r) => r.pct < 0.85).length,
      rows,
    };
  }

  addEntry(user: UserClaims, dto: EntryDto): Promise<QuantityEntryEntity> {
    return this.entries.save(
      this.entries.create({ ...dto, note: dto.note ?? null, enteredBy: user.email, entity: user.entity, createdBy: user.email }),
    );
  }

  entriesFor(projectId: string): Promise<QuantityEntryEntity[]> {
    return this.entries.find({ where: { projectId }, order: { weekOf: 'DESC' }, take: 60 });
  }

  /** Upsert a month's projected ₱ accomplishment. */
  async setProjection(user: UserClaims, dto: ProjectionDto): Promise<MonthProjectionEntity> {
    const found = await this.projections.findOne({ where: { projectId: dto.projectId, month: dto.month } });
    if (found) {
      found.projectedAmount = dto.projectedAmount;
      return this.projections.save(found);
    }
    return this.projections.save(this.projections.create({ ...dto, entity: user.entity, createdBy: user.email }));
  }

  projectionsFor(projectId: string): Promise<MonthProjectionEntity[]> {
    return this.projections.find({ where: { projectId }, order: { month: 'ASC' } });
  }

  /** Upsert a material qty for a project-month. */
  async setMaterial(user: UserClaims, dto: MaterialDto): Promise<MaterialReqEntity> {
    const found = await this.materials.findOne({ where: { projectId: dto.projectId, month: dto.month, material: dto.material } });
    if (found) {
      found.qty = dto.qty;
      found.unit = dto.unit;
      return this.materials.save(found);
    }
    return this.materials.save(this.materials.create({ ...dto, entity: user.entity, createdBy: user.email }));
  }

  materialsFor(projectId: string): Promise<MaterialReqEntity[]> {
    return this.materials.find({ where: { projectId }, order: { month: 'ASC' } });
  }

  async seed(): Promise<void> {
    if ((await this.entries.count()) > 0) return;
    const projects = await this.projects.find();
    // Backfill in-house amounts + PE + prior accomplishment + a few weekly entries.
    const profile: Record<string, { inhouse: number; pe: string; prior: number; weeks: number[] }> = {
      'PKG-02': { inhouse: 214435919, pe: 'J. Labadia', prior: 150000000, weeks: [3439516, 2890000, 3120000] },
      'PKG-05': { inhouse: 169137006, pe: 'J. Paraso', prior: 96000000, weeks: [4100000, 3800000, 2950000] },
      'PKG-11': { inhouse: 44427777, pe: 'R. Santos', prior: 24280766, weeks: [2100000, 1980000, 2160000] },
      'PKG-03': { inhouse: 86807306, pe: 'M. Dela Cruz', prior: 60000000, weeks: [1800000, 1500000] },
      'PKG-07': { inhouse: 97329310, pe: 'E. Devora', prior: 71000000, weeks: [1200000, 900000] },
      'PKG-09': { inhouse: 120000000, pe: 'B. Gutierrez', prior: 30000000, weeks: [3000000, 2500000] },
    };
    for (const p of projects) {
      const prof = profile[p.code];
      if (!prof) continue;
      p.inhouseAmount = prof.inhouse;
      p.pe = prof.pe;
      p.priorAccomplished = prof.prior;
      await this.projects.save(p);
      const today = new Date();
      for (let i = 0; i < prof.weeks.length; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - 7 * (prof.weeks.length - i));
        await this.entries.save(
          this.entries.create({ projectId: p.id, weekOf: d.toISOString().slice(0, 10), amount: prof.weeks[i], enteredBy: 'seed', createdBy: 'seed' }),
        );
      }
      // a forward projection + a couple material lines for the next 3 months
      const months = [0, 1, 2].map((k) => {
        const d = new Date(today.getFullYear(), today.getMonth() + 1 + k, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
      for (const m of months) {
        await this.projections.save(this.projections.create({ projectId: p.id, month: m, projectedAmount: prof.weeks[0] * 4, createdBy: 'seed' }));
        await this.materials.save(this.materials.create({ projectId: p.id, month: m, material: 'Cement Tonner', unit: 'tonner bags', qty: 120, createdBy: 'seed' }));
        await this.materials.save(this.materials.create({ projectId: p.id, month: m, material: 'Item 200', unit: 'cu.m', qty: 200, createdBy: 'seed' }));
      }
    }
  }
}

@Controller('quantity')
export class QuantityController {
  constructor(private readonly svc: QuantityService) {}

  @Get('rollup') rollup(): Promise<QuantityRollup[]> { return this.svc.rollup(); }
  @Get('head') head(): ReturnType<QuantityService['headSummary']> { return this.svc.headSummary(); }
  @Get('entries') entries(@Query('projectId') id: string): Promise<QuantityEntryEntity[]> { return this.svc.entriesFor(id); }
  @Post('entry') addEntry(@CurrentUser() u: UserClaims, @Body() dto: EntryDto): Promise<QuantityEntryEntity> { return this.svc.addEntry(u, dto); }

  @Get('projections') projections(@Query('projectId') id: string): Promise<MonthProjectionEntity[]> { return this.svc.projectionsFor(id); }
  @Post('projection') setProjection(@CurrentUser() u: UserClaims, @Body() dto: ProjectionDto): Promise<MonthProjectionEntity> { return this.svc.setProjection(u, dto); }
  @Get('materials') materials(@Query('projectId') id: string): Promise<MaterialReqEntity[]> { return this.svc.materialsFor(id); }
  @Post('material') setMaterial(@CurrentUser() u: UserClaims, @Body() dto: MaterialDto): Promise<MaterialReqEntity> { return this.svc.setMaterial(u, dto); }
}

@Module({
  imports: [TypeOrmModule.forFeature([QuantityEntryEntity, MonthProjectionEntity, MaterialReqEntity, ProjectEntity])],
  controllers: [QuantityController],
  providers: [QuantityService],
  exports: [QuantityService],
})
export class QuantityModule {}
