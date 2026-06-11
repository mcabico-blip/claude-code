import { Controller, Get, Injectable, Module, OnModuleInit } from '@nestjs/common';
import type { FlaggedProject } from '@ubi/types';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ApprovalsService } from '../../shared/approvals/approvals.service';

/**
 * Operations = the VPO control tower: approvals inbox (shared engine),
 * project health, subcon registry. First-stop rectification before the CEO.
 */
@Injectable()
export class OperationsService implements OnModuleInit {
  constructor(
    private readonly registry: ReadModelRegistry,
    private readonly approvals: ApprovalsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        key: 'operations.health',
        module: 'operations',
        title: 'Project health / flagged projects',
        description: 'Pre-vetted flags — the CEO sees the residue, not the noise.',
      },
      () => this.flagged(),
    );
  }

  /** Scaffold flags — wire to engineering slippage + SWA gaps in refine pass. */
  flagged(): FlaggedProject[] {
    return [
      {
        projectCode: 'PKG-05',
        projectName: 'Daang Maharlika Rehab K1440',
        pe: 'dela Cruz',
        pm: 'Uy',
        slippagePct: -4.6,
        projectedPct: -6.2,
        trend: [-2.1, -2.8, -3.5, -4.1, -4.6],
      },
      {
        projectCode: 'PKG-02',
        projectName: 'Iligan Coastal Diversion',
        pe: 'Ramos',
        pm: 'Lim',
        slippagePct: -1.2,
        projectedPct: -0.8,
        trend: [-1.9, -1.7, -1.6, -1.4, -1.2],
      },
      {
        projectCode: 'PKG-11',
        projectName: 'Bukidnon Boundary Rd',
        pe: 'Santos',
        pm: 'Go',
        slippagePct: 3.1,
        projectedPct: 3.4,
        trend: [1.2, 1.8, 2.2, 2.7, 3.1],
      },
    ];
  }

  async summary(): Promise<{ pendingApprovals: number; flagged: FlaggedProject[] }> {
    return { pendingApprovals: await this.approvals.countPending(), flagged: this.flagged() };
  }
}

@Controller('operations')
export class OperationsController {
  constructor(private readonly svc: OperationsService) {}

  @Get('health')
  health(): Promise<{ pendingApprovals: number; flagged: FlaggedProject[] }> {
    return this.svc.summary();
  }
}

@Module({
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
