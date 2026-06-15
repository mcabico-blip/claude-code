import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FlaggedProject, Insight, ManComSnapshot, TrendPoint, UserClaims } from '@ubi/types';
import { Repository } from 'typeorm';
import { CurrentUser, RequireClaims } from '../../common/rbac';
import { InsightEntity } from '../../pillars/ai-layer/insight.entity';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ApprovalsService } from '../../shared/approvals/approvals.service';
import { ProjectEntity } from '../engineering/entities';
import { EngineeringModule } from '../engineering/engineering.module';
import { QuantityModule, QuantityService } from '../quantity/quantity.module';
import { seedReportFeed } from '../stubs/stubs.module';

/**
 * CEO / Office of the President — the endpoint. Consolidates every
 * department through the Pillar-3 registry; ships last, but its read-model
 * demands are designed in from day one.
 */
@Injectable()
export class CeoService {
  constructor(
    private readonly registry: ReadModelRegistry,
    private readonly approvals: ApprovalsService,
    private readonly quantity: QuantityService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(InsightEntity) private readonly insights: Repository<InsightEntity>,
  ) {}

  private async fromRegistry<T>(user: UserClaims, key: string, fallback: T): Promise<T> {
    const model = this.registry.get(key);
    if (!model) return fallback;
    return (await model.handler(user)) as T;
  }

  private toInsight(row: InsightEntity): Insight {
    return {
      id: row.id,
      severity: row.severity,
      title: row.title,
      body: row.body,
      evidence: row.evidence,
      actions: row.actions,
      generatedAt: row.createdAt.toISOString(),
      generatedBy: row.generatedBy,
    };
  }

  async snapshot(user: UserClaims): Promise<ManComSnapshot> {
    const projects = await this.projects.find({ where: { status: 'active' } });
    const flagged = await this.fromRegistry<FlaggedProject[]>(user, 'operations.health', []);
    const exceptions = await this.fromRegistry<Array<{ status: string }>>(user, 'audit.exceptions', []);
    const accomplishment = await this.fromRegistry<TrendPoint[]>(user, 'engineering.swa', []);
    const surveyVolumes = await this.fromRegistry<TrendPoint[]>(user, 'survey.volumes', []);
    const topInsights = (
      await this.insights.find({ where: { dismissed: false }, order: { createdAt: 'DESC' }, take: 3 })
    ).map((r) => this.toInsight(r));

    const avgSlippage = projects.length
      ? projects.reduce((sum, p) => sum + p.slippagePct, 0) / projects.length
      : 0;

    // Real accomplishment from the Quantity weekly rollup (QE field entries).
    const qhead = await this.quantity.headSummary();
    const quantityTop = qhead.rows
      .slice()
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 5)
      .map((r) => ({ code: r.code, name: r.name, pe: r.pe, pct: r.pct, thisMonth: r.thisMonth }));

    return {
      asOf: new Date().toISOString(),
      kpis: {
        activeProjects: projects.length,
        flaggedProjects: flagged.filter((f) => f.slippagePct < 0).length,
        billingsMonthCentavos: 18_240_000_000,
        billingsDeltaPct: 12,
        billingDraftsSubmitted: 21,
        billingDraftsTotal: 34,
        avgSlippagePct: Number(avgSlippage.toFixed(2)),
        projectedSlippagePct: Number((avgSlippage - 0.6).toFixed(2)),
        openExceptions: exceptions.length,
        escalatedExceptions: exceptions.filter((e) => e.status === 'escalated').length,
        accomplishmentPct: Number(qhead.overallPct.toFixed(4)),
        accomplishmentMonth: Math.round(qhead.thisMonth),
      },
      accomplishment,
      surveyVolumes,
      flagged,
      reportFeed: seedReportFeed(),
      topInsights,
      quantityTop,
    };
  }

  async allInsights(): Promise<Insight[]> {
    const rows = await this.insights.find({
      where: { dismissed: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((r) => this.toInsight(r));
  }
}

@Controller('ceo')
@RequireClaims('role:ceo', 'role:vpo')
export class CeoController {
  constructor(private readonly svc: CeoService) {}

  @Get('mancom')
  mancom(@CurrentUser() user: UserClaims): Promise<ManComSnapshot> {
    return this.svc.snapshot(user);
  }

  @Get('insights')
  insights(): Promise<Insight[]> {
    return this.svc.allInsights();
  }
}

@Module({
  imports: [EngineeringModule, QuantityModule],
  controllers: [CeoController],
  providers: [CeoService],
})
export class CeoModule {}
