import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { Repository } from 'typeorm';
import { InsightEntity } from '../pillars/ai-layer/insight.entity';
import { AuthService } from '../pillars/auth/auth.service';
import { DocTrackingModule } from '../pillars/doc-tracking/doc-tracking.module';
import { DocTrackingService } from '../pillars/doc-tracking/doc-tracking.service';
import { DEPARTMENTS } from '../modules/dept/dept.module';
import { EngineeringModule } from '../modules/engineering/engineering.module';
import { PayItemEntity, ProjectEntity } from '../modules/engineering/entities';
import { EquipmentModule, EquipmentService } from '../modules/equipment/equipment.module';
import { ItModule, ItService } from '../modules/it/it.module';
import { PropertyModule, PropertyService } from '../modules/property/property.module';
import { QuantityModule, QuantityService } from '../modules/quantity/quantity.module';
import { RecordsModule, RecordsService } from '../modules/records/records.module';
import { ExpiryService } from '../shared/expiry/expiry.module';

/** Dev/demo seed — idempotent; runs only when the database is empty. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly docs: DocTrackingService,
    private readonly expiry: ExpiryService,
    private readonly property: PropertyService,
    private readonly records: RecordsService,
    private readonly it: ItService,
    private readonly quantity: QuantityService,
    private readonly equipment: EquipmentService,
    @InjectRepository(PayItemEntity) private readonly payItems: Repository<PayItemEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(InsightEntity) private readonly insights: Repository<InsightEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Demo data carries PUBLIC passwords — never allowed to reach production.
    if (this.config.get('SEED_DEMO') !== 'true') {
      this.log.log('SEED_DEMO != true — skipping demo seed');
      return;
    }

    // Accounts are idempotent (ensureUser returns existing) — run every boot so
    // newly-added dept-head accounts also backfill onto an existing demo DB.
    await this.auth.ensureUser({ email: 'admin@ubi.ph', name: 'Suite Admin', password: 'admin123', claims: ['role:admin'] });
    const ceo = await this.auth.ensureUser({ email: 'ceo@ubi.ph', name: 'E. Castillo', password: 'ceo123', claims: ['role:ceo'] });
    await this.auth.ensureUser({ email: 'vpo@ubi.ph', name: 'VPO Office', password: 'vpo123', claims: ['role:vpo', 'dept:operations'] });
    await this.auth.ensureUser({ email: 'pm@ubi.ph', name: 'PM Uy', password: 'pm123', claims: ['role:pm', 'dept:engineering'] });
    await this.auth.ensureUser({
      email: 'pe@ubi.ph', name: 'Engr. R. dela Cruz', password: 'pe123',
      claims: ['role:pe', 'dept:engineering', 'scope:project-PKG-02'], isField: true,
    });
    await this.auth.ensureUser({ email: 'insights-agent@ubi.ph', name: 'Insights Agent (off-box)', password: 'agent123', claims: ['agent:insights'] });
    for (const d of DEPARTMENTS) {
      await this.auth.ensureUser({
        email: d.headEmail, name: d.headName, password: 'head123',
        claims: ['role:manager', `dept:${d.slug}`],
      });
    }
    const ceoClaims: UserClaims = this.auth.toClaims(ceo);

    // Core reference data (pay items, projects, demo insights, a sample doc) —
    // only on a fresh DB.
    if ((await this.payItems.count()) === 0) {
      this.log.log('empty database — seeding core reference data');
      await this.payItems.save(
        [
          { itemNo: '100(3)', description: 'Clearing and grubbing', unit: 'ha' },
          { itemNo: '200', description: 'Aggregate subbase course', unit: 'm³' },
          { itemNo: '300(1)', description: 'Aggregate base course', unit: 'm³' },
          { itemNo: '311(1)c', description: 'PCC Pavement (plain) 230mm', unit: 'm²' },
          { itemNo: '404(1)', description: 'Reinforcing steel, Grade 40', unit: 'kg' },
          { itemNo: 'SPL-1', description: 'Special item — project signage', unit: 'l.s.' },
        ].map((p) => this.payItems.create({ ...p, createdBy: 'seed' })),
      );

      const packages: Array<[string, string, number]> = [
        ['PKG-02', 'Iligan Coastal Diversion', -1.2],
        ['PKG-05', 'Daang Maharlika Rehab K1440', -4.6],
        ['PKG-11', 'Bukidnon Boundary Rd', 3.1],
        ['PKG-03', 'Cagayan Valley Access Rd', 0.4],
        ['PKG-07', 'Misamis Slope Protection', -0.6],
        ['PKG-09', 'Tagoloan Bridge Approach', 1.9],
      ];
      await this.projects.save(
        packages.map(([code, name, slip], i) =>
          this.projects.create({
            code, name, contractNo: `26${String(i + 1).padStart(2, '0')}-DPWH-X`,
            status: 'active', slippagePct: slip, createdBy: 'seed',
          }),
        ),
      );

      await this.insights.save(
        [
          {
            severity: 'critical' as const,
            title: 'Pkg 5 trends to −6.2% slippage by July',
            body:
              'Cement deliveries from Solid Mix Corp arrived late 3 consecutive weeks (avg 2.4 days). ' +
              'PCCP pours on Item 311 are 1,180 m² behind program; the weekly SWA gap has widened each week since wk 22.',
            evidence: ['procurement.dr-log wk22–24', 'engineering.swa wk22–24', 'survey.volumes Δ STA 4+200–5+600'],
            actions: ['view-evidence', 'send-to-vpo', 'raise-audit-exception'],
          },
          {
            severity: 'warning' as const,
            title: 'Billing No. 7 (Pkg 2) blocked by MQC certs',
            body: '2 material certificates (Item 311 beam tests) pending 6 days. Billing draft is otherwise complete.',
            evidence: ['mqc.certs', 'engineering.billing №7'],
            actions: ['view-evidence', 'nudge-mqc'],
          },
          {
            severity: 'warning' as const,
            title: '4 vehicle registrations expire within 15 days',
            body: '3 dump trucks (Pkg 5 haul fleet) + 1 service vehicle. Renewal lead time averages 9 days.',
            evidence: ['records.expiry'],
            actions: ['view-list', 'notify-records'],
          },
          {
            severity: 'positive' as const,
            title: 'Pkg 11 ahead of plan 6 consecutive weeks',
            body: '+3.1% and climbing; subbase complete 3 weeks early. Consider advancing Billing No. 4.',
            evidence: ['engineering.swa', 'operations.health'],
            actions: ['view-project'],
          },
        ].map((i) => this.insights.create({ ...i, generatedBy: 'seed (off-box agent pattern)', createdBy: 'seed' })),
      );

      const doc = await this.docs.create(ceoClaims, {
        type: 'transmittal',
        title: 'Billing No. 7 — attachments batch (PKG-02)',
        location: 'HQ · Engineering 3F',
      });
      await this.docs.transmit(ceoClaims, doc.code, 'Finance — J. Ramos', 'for cashier batching');
    }

    // Module data — each seed is INDEPENDENTLY idempotent, so always run them.
    // This backfills newly-deployed modules (Quantity in-house amounts, Property
    // assets, IT/Records/Equipment) onto an existing demo DB — no DB drop needed.
    await this.property.seed('seed');
    await this.records.seed('seed');
    await this.it.seed(ceoClaims);
    await this.quantity.seed();
    const pkg05 = await this.projects.findOne({ where: { code: 'PKG-05' } });
    if (pkg05) await this.equipment.seed(ceoClaims, pkg05.id);

    this.log.log('seed complete — ceo@ubi.ph/ceo123, admin/vpo/pm/pe, + dept heads head-<dept>@ubi.ph/head123');
  }
}

@Module({
  imports: [DocTrackingModule, EngineeringModule, PropertyModule, RecordsModule, ItModule, QuantityModule, EquipmentModule],
  providers: [SeedService],
})
export class SeedModule {}
