import { Controller, Get, Injectable, Module, OnModuleInit } from '@nestjs/common';
import type { ReportStatus } from '@ubi/types';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { DocTrackingService } from '../../pillars/doc-tracking/doc-tracking.service';
import { DocTrackingModule } from '../../pillars/doc-tracking/doc-tracking.module';
import { ExpiryService } from '../../shared/expiry/expiry.module';
import { TicketingService } from '../../shared/ticketing/ticketing.module';

/**
 * Breadth-first stubs for Survey, MQC, Audit, IT, Records, Clinic, Admin,
 * HR, Property and Finance: each registers its Pillar-3 read surface now so
 * the contract exists from day one; deep workflows land on their module
 * branches (survey, mqc, audit, it, records, clinic, admin, hr, property,
 * finance) in later sessions.
 */
@Injectable()
export class StubReadModelsService implements OnModuleInit {
  constructor(
    private readonly registry: ReadModelRegistry,
    private readonly expiry: ExpiryService,
    private readonly ticketing: TicketingService,
    private readonly docs: DocTrackingService,
  ) {}

  onModuleInit(): void {
    // survey.volumes and mqc.certs are now owned by SurveyModule and MqcModule.

    this.registry.register(
      {
        key: 'audit.exceptions',
        module: 'audit',
        title: 'Exception / investigation register',
        description: 'Raised → investigating → resolved/escalated, full trail.',
      },
      () => [
        { id: 'EXC-031', title: 'Fuel variance PKG-05 haul fleet', status: 'escalated', raised: '2026-05-28' },
        { id: 'EXC-034', title: 'Unmatched DR vs PO — aggregates', status: 'escalated', raised: '2026-06-02' },
        { id: 'EXC-035', title: 'PPE issuance gap, site 11', status: 'investigating', raised: '2026-06-08' },
      ],
    );

    // NOTE: it.capacity, records.expiry and property.assets are now owned by
    // the real ItModule / RecordsModule / PropertyModule.

    this.registry.register(
      {
        key: 'clinic.aggregate',
        module: 'clinic',
        title: 'Clinic aggregate health summary',
        description: 'AGGREGATE ONLY — individual medical records never leave the isolated clinic store.',
      },
      () => ({
        month: '2026-06',
        medicalExamCompletionPct: 92,
        clinicVisits: 138,
        injuries: 2,
        doleReportsOnTime: true,
      }),
    );

    this.registry.register(
      {
        key: 'admin.tickets',
        module: 'admin',
        title: 'Admin inquiries (shared ticketing)',
        description: 'Site inquiries/requests routed through the shared engine.',
      },
      () => this.ticketing.list('admin'),
    );

    this.registry.register(
      {
        key: 'hr.hours',
        module: 'hr',
        title: 'Hours computation runs',
        description: 'OT/ND totals computed from attendance, pushed to Ezacctg.',
      },
      () => [{ run: '2026-06-A', period: 'Jun 1–15', status: 'computed', pushedToEzacctg: false, employees: 487 }],
    );

    this.registry.register(
      {
        key: 'finance.doc-flow',
        module: 'finance',
        title: 'Documents with Finance (batches to cashier)',
        description: "Finance is a consumer of Document Tracking — only the docs it currently holds or is batching. The registry itself is monitored by Records.",
      },
      async () => {
        const docs = await this.docs.list();
        return docs.filter(
          (d) => d.currentHolder.toLowerCase().includes('finance') || d.currentLocation.toLowerCase().includes('cashier'),
        );
      },
    );
  }
}

/** Per-department summary endpoints, all answering from the registry. */
@Controller()
export class StubsController {
  constructor(private readonly registry: ReadModelRegistry) {}

  private query(key: string): unknown {
    const model = this.registry.get(key);
    return model
      ? model.handler({ sub: 'system', email: 'system', name: 'system', entity: 'UBI', claims: ['role:admin'] })
      : { error: `read model ${key} not registered` };
  }

  // it, records, property, survey, mqc own their own routes now.
  @Get('audit/exceptions') audit(): unknown { return this.query('audit.exceptions'); }
  @Get('clinic/aggregate') clinic(): unknown { return this.query('clinic.aggregate'); }
  @Get('hr/hours') hr(): unknown { return this.query('hr.hours'); }
  @Get('finance/doc-flow') finance(): unknown { return this.query('finance.doc-flow'); }
}

/** Uniform report-status feed (the `*.report-status` contract) — seed shape. */
export function seedReportFeed(): ReportStatus[] {
  return [
    { module: 'engineering', report: 'SWA wk 24', due: '2026-06-10', submittedAt: '2026-06-09', status: 'on-time' },
    { module: 'survey', report: 'May volumes', due: '2026-06-05', submittedAt: '2026-06-04', status: 'received' },
    { module: 'mqc', report: 'Certs — Billing No. 7', due: '2026-06-05', submittedAt: null, status: 'pending', detail: '2 pending · 6d' },
    { module: 'procurement', report: 'DR sync', due: null, submittedAt: '2026-06-11', status: 'on-time', detail: '14 today' },
    { module: 'operations', report: 'Approvals queue', due: null, submittedAt: null, status: 'pending', detail: '8 waiting' },
    { module: 'audit', report: 'Exceptions', due: null, submittedAt: null, status: 'late', detail: '2 escalated' },
    { module: 'clinic', report: 'June health summary', due: '2026-07-01', submittedAt: null, status: 'aggregate-only' },
  ];
}

@Module({
  imports: [DocTrackingModule],
  controllers: [StubsController],
  providers: [StubReadModelsService],
})
export class StubsModule {}
