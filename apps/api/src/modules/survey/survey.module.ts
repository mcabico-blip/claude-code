import {
  Body,
  Controller,
  Get,
  Module,
  OnModuleInit,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import {
  Column,
  Entity,
  Repository,
} from 'typeorm';
import type { TrendPoint } from '@ubi/types';
import { BaseAppEntity } from '../../common/base.entity';
import { Claims } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { AiLayerModule } from '../../pillars/ai-layer/ai-layer.module';

// ──────────────────────────── Entities ────────────────────────────

/**
 * Weekly/monthly measurement captured by QE — volume by pay item + chainage.
 */
@Entity('survey_measurement')
export class SurveyMeasurement extends BaseAppEntity {
  @Column({ name: 'project_id', type: 'varchar' })
  projectId: string;

  /** STA 0+000 format — start of measured section. */
  @Column({ name: 'station_start', type: 'varchar', length: 16 })
  stationStart: string;

  /** STA 0+000 format — end of measured section. */
  @Column({ name: 'station_end', type: 'varchar', length: 16 })
  stationEnd: string;

  /** DPWH Blue Book pay-item number, e.g. "311(1)c". */
  @Column({ name: 'pay_item_no', type: 'varchar', length: 32 })
  payItemNo: string;

  /** Measured volume (m³). */
  @Column({ name: 'volume_m3', type: 'numeric', precision: 12, scale: 3 })
  volumeM3: number;

  /** Measurement type: original-ground | stakeout | cross-section | as-built */
  @Column({ type: 'varchar', length: 32, default: 'cross-section' })
  type: string;

  /** YYYY-MM reporting period. */
  @Column({ name: 'period', type: 'varchar', length: 7 })
  period: string;

  @Column({ name: 'surveyor_id', type: 'varchar', nullable: true })
  surveyorId: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}

/**
 * Cross-section data point — area at a station (feeds quantity computation).
 */
@Entity('survey_cross_section')
export class SurveyCrossSection extends BaseAppEntity {
  @Column({ name: 'project_id', type: 'varchar' })
  projectId: string;

  @Column({ name: 'station', type: 'varchar', length: 16 })
  station: string;

  /** Pay item this cross-section belongs to. */
  @Column({ name: 'pay_item_no', type: 'varchar', length: 32 })
  payItemNo: string;

  /** Cross-sectional area in m². */
  @Column({ name: 'area_m2', type: 'numeric', precision: 10, scale: 4 })
  areaM2: number;

  /** Interval length used for prismoidal formula (m). */
  @Column({ name: 'interval_m', type: 'numeric', precision: 8, scale: 3, nullable: true })
  intervalM: number | null;

  @Column({ name: 'computed_volume_m3', type: 'numeric', precision: 12, scale: 3, nullable: true })
  computedVolumeM3: number | null;
}

// ──────────────────────────── Service ────────────────────────────

import { Injectable } from '@nestjs/common';

@Injectable()
export class SurveyService implements OnModuleInit {
  constructor(
    @InjectRepository(SurveyMeasurement) private readonly measurements: Repository<SurveyMeasurement>,
    @InjectRepository(SurveyCrossSection) private readonly sections: Repository<SurveyCrossSection>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        key: 'survey.volumes',
        module: 'survey',
        title: 'Monthly survey volumes (m³)',
        description: 'Aggregated from real measurements; station/chainage indexed. Feeds ManCom.',
      },
      async () => this.monthlyTrend(),
    );
  }

  async monthlyTrend(): Promise<TrendPoint[]> {
    // Aggregate real measurements grouped by period.
    const rows: { period: string; total: string }[] = await this.measurements
      .createQueryBuilder('m')
      .select('m.period', 'period')
      .addSelect('SUM(m.volume_m3)', 'total')
      .where('m.deleted_at IS NULL')
      .groupBy('m.period')
      .orderBy('m.period', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      period: r.period,
      plan: null,
      actual: Math.round(Number(r.total)),
      projected: null,
    }));
  }

  async listByProject(projectId: string): Promise<SurveyMeasurement[]> {
    return this.measurements.find({
      where: { projectId },
      order: { period: 'ASC', stationStart: 'ASC' },
      withDeleted: false,
    });
  }

  async submit(data: Partial<SurveyMeasurement>, actor: string): Promise<SurveyMeasurement> {
    const m = this.measurements.create({ ...data, createdBy: actor });
    return this.measurements.save(m);
  }

  async crossSections(projectId: string, payItemNo?: string): Promise<SurveyCrossSection[]> {
    const qb = this.sections
      .createQueryBuilder('cs')
      .where('cs.project_id = :pid', { pid: projectId })
      .andWhere('cs.deleted_at IS NULL');
    if (payItemNo) qb.andWhere('cs.pay_item_no = :item', { item: payItemNo });
    return qb.orderBy('cs.station', 'ASC').getMany();
  }

  async submitCrossSection(data: Partial<SurveyCrossSection>, actor: string): Promise<SurveyCrossSection> {
    const cs = this.sections.create({ ...data, createdBy: actor });
    return this.sections.save(cs);
  }
}

// ──────────────────────────── Controller ────────────────────────────

interface JwtRequest {
  user: { sub: string; email: string; name: string; entity: string; claims: string[] };
}

@Controller('survey')
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Get('volumes')
  trend(): Promise<TrendPoint[]> {
    return this.survey.monthlyTrend();
  }

  @Get('projects/:projectId')
  @Claims('role:manager', 'dept:survey', 'dept:engineering', 'role:ceo', 'role:vpo')
  listByProject(@Param('projectId') projectId: string): Promise<SurveyMeasurement[]> {
    return this.survey.listByProject(projectId);
  }

  @Post('projects/:projectId/measurements')
  @Claims('dept:survey', 'role:manager')
  submitMeasurement(
    @Param('projectId') projectId: string,
    @Body() body: Partial<SurveyMeasurement>,
    @Req() req: JwtRequest,
  ): Promise<SurveyMeasurement> {
    return this.survey.submit({ ...body, projectId }, req.user.email);
  }

  @Get('projects/:projectId/cross-sections')
  @Claims('role:manager', 'dept:survey', 'dept:engineering', 'role:ceo', 'role:vpo')
  crossSections(
    @Param('projectId') projectId: string,
  ): Promise<SurveyCrossSection[]> {
    return this.survey.crossSections(projectId);
  }

  @Post('projects/:projectId/cross-sections')
  @Claims('dept:survey', 'role:manager')
  submitCrossSection(
    @Param('projectId') projectId: string,
    @Body() body: Partial<SurveyCrossSection>,
    @Req() req: JwtRequest,
  ): Promise<SurveyCrossSection> {
    return this.survey.submitCrossSection({ ...body, projectId }, req.user.email);
  }
}

// ──────────────────────────── Module ────────────────────────────

@Module({
  imports: [
    TypeOrmModule.forFeature([SurveyMeasurement, SurveyCrossSection]),
    AiLayerModule,
  ],
  controllers: [SurveyController],
  providers: [SurveyService],
  exports: [SurveyService],
})
export class SurveyModule {}
