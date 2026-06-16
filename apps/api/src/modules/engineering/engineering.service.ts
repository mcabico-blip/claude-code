import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { MaterialsScheduleLine, TrendPoint, UserClaims } from '@ubi/types';
import { Repository } from 'typeorm';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ApprovalsService } from '../../shared/approvals/approvals.service';
import { MaterialsScheduleEntity, PayItemEntity, ProjectEntity } from './entities';

@Injectable()
export class EngineeringService implements OnModuleInit {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(PayItemEntity) private readonly payItems: Repository<PayItemEntity>,
    @InjectRepository(MaterialsScheduleEntity)
    private readonly schedules: Repository<MaterialsScheduleEntity>,
    private readonly approvals: ApprovalsService,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        key: 'engineering.swa',
        module: 'engineering',
        title: 'Accomplishment vs plan (cumulative ₱M)',
        description: 'Weekly SWA consolidated against the program of work; monthly billing draws from this.',
      },
      () => this.accomplishmentTrend(),
    );
    this.registry.register(
      {
        key: 'engineering.projects',
        module: 'engineering',
        title: 'Project register',
        description: 'Active DPWH packages with slippage.',
      },
      () => this.listProjects(),
    );
  }

  /**
   * Scaffold trend: derived constants until SWA capture lands. Shape is the
   * contract — solid history, null-projected tail filled by the caller.
   */
  accomplishmentTrend(): TrendPoint[] {
    const plan = [120, 265, 430, 610, 800, 980, 1130, 1290];
    const actual = [112, 248, 401, 575, 742, 905, null, null];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    return months.map((period, i) => ({
      period,
      plan: plan[i],
      actual: actual[i],
      projected: actual[i] === null ? 905 + (i - 5) * 155 : null,
    }));
  }

  listProjects(): Promise<ProjectEntity[]> {
    return this.projects.find({ order: { code: 'ASC' } });
  }

  listPayItems(): Promise<PayItemEntity[]> {
    return this.payItems.find({ order: { itemNo: 'ASC' } });
  }

  /** AI-assisted prefill: stub from remaining program quantities (off-box AI later). */
  async aiPrefill(projectId: string): Promise<MaterialsScheduleLine[]> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('no such project');
    return [
      { payItemNo: '311(1)c', material: 'Cement (Type 1)', quantity: 1240, unit: 'bags', aiSuggested: true },
      { payItemNo: '200', material: 'Aggregate subbase course', quantity: 850, unit: 'm³', aiSuggested: true },
      { payItemNo: '404(1)', material: 'RSB 16mm', quantity: 12.4, unit: 't', aiSuggested: true },
    ];
  }

  async createSchedule(
    user: UserClaims,
    input: { projectId: string; weekOf: string; lines: MaterialsScheduleLine[] },
  ): Promise<MaterialsScheduleEntity> {
    return this.schedules.save(
      this.schedules.create({
        projectId: input.projectId,
        weekOf: input.weekOf,
        lines: input.lines,
        status: 'draft',
        preparedBy: user.email,
        entity: user.entity,
        createdBy: user.email,
      }),
    );
  }

  /** PE submits → PM approves → VPO. Approved schedule flows to Procurement. */
  async submitSchedule(user: UserClaims, id: string): Promise<MaterialsScheduleEntity> {
    const schedule = await this.schedules.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('no such schedule');
    schedule.status = 'submitted';
    await this.approvals.open(user, {
      subjectType: 'materials-schedule',
      subjectId: schedule.id,
      title: `Weekly materials schedule — wk of ${schedule.weekOf}`,
      steps: [
        { step: 'pm', actorClaim: 'role:pm' },
        { step: 'vpo', actorClaim: 'role:vpo' },
      ],
    });
    return this.schedules.save(schedule);
  }

  listSchedules(): Promise<MaterialsScheduleEntity[]> {
    return this.schedules.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
