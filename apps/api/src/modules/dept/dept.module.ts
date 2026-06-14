import { Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import type { UserClaims } from '@ubi/types';
import { CurrentUser, hasClaim } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { ApprovalsService } from '../../shared/approvals/approvals.service';
import { seedReportFeed } from '../stubs/stubs.module';

/** One definition per department — head account, the read-model it monitors,
 *  and its CCTV camera id. Standard dashboard shape is derived from this. */
export interface DeptDef {
  slug: string;
  label: string;
  /** Pillar-3 read-model key that holds "what this dept monitors". */
  readModelKey: string;
  monitoringTitle: string;
  cameraId: string;
  headEmail: string;
  headName: string;
}

export const DEPARTMENTS: DeptDef[] = [
  { slug: 'engineering', label: 'Engineering', readModelKey: 'engineering.projects', monitoringTitle: 'Projects & accomplishment', cameraId: 'CAM-ENG-01', headEmail: 'head-engineering@ubi.ph', headName: 'Engr. A. Salonga' },
  { slug: 'procurement', label: 'Procurement', readModelKey: 'procurement.supplier-performance', monitoringTitle: 'Supplier delivery performance', cameraId: 'CAM-PRC-01', headEmail: 'head-procurement@ubi.ph', headName: 'M. Tan' },
  { slug: 'operations', label: 'Operations (VPO)', readModelKey: 'operations.health', monitoringTitle: 'Project health & flags', cameraId: 'CAM-OPS-01', headEmail: 'head-operations@ubi.ph', headName: 'VPO Office' },
  { slug: 'survey', label: 'Survey', readModelKey: 'survey.volumes', monitoringTitle: 'Monthly volumes by station', cameraId: 'CAM-SUR-01', headEmail: 'head-survey@ubi.ph', headName: 'Engr. L. Reyes' },
  { slug: 'mqc', label: 'MQC', readModelKey: 'mqc.certs', monitoringTitle: 'Test & certificate queue', cameraId: 'CAM-MQC-01', headEmail: 'head-mqc@ubi.ph', headName: 'Engr. P. Cruz' },
  { slug: 'audit', label: 'Audit', readModelKey: 'audit.exceptions', monitoringTitle: 'Exception / investigation register', cameraId: 'CAM-AUD-01', headEmail: 'head-audit@ubi.ph', headName: 'C. Domingo' },
  { slug: 'it', label: 'IT', readModelKey: 'it.capacity', monitoringTitle: 'Capacity, devices & helpdesk', cameraId: 'CAM-IT-01', headEmail: 'head-it@ubi.ph', headName: 'Marvin (IT Head)' },
  { slug: 'records', label: 'Records', readModelKey: 'records.expiry', monitoringTitle: 'Expiring documents & registry', cameraId: 'CAM-REC-01', headEmail: 'head-records@ubi.ph', headName: 'R. Bautista' },
  { slug: 'clinic', label: 'Clinic', readModelKey: 'clinic.aggregate', monitoringTitle: 'Aggregate health (isolated)', cameraId: 'CAM-CLN-01', headEmail: 'head-clinic@ubi.ph', headName: 'Dr. S. Lim' },
  { slug: 'admin', label: 'Admin / OHS', readModelKey: 'admin.tickets', monitoringTitle: 'Inquiries, OHS & dispensing', cameraId: 'CAM-ADM-01', headEmail: 'head-admin@ubi.ph', headName: 'G. Flores' },
  { slug: 'hr', label: 'HR', readModelKey: 'hr.hours', monitoringTitle: 'Hours computation runs', cameraId: 'CAM-HR-01', headEmail: 'head-hr@ubi.ph', headName: 'J. Aquino' },
  { slug: 'property', label: 'Property', readModelKey: 'property.assets', monitoringTitle: 'Asset custody (QR EAM)', cameraId: 'CAM-PRP-01', headEmail: 'head-property@ubi.ph', headName: 'D. Ong' },
  { slug: 'finance', label: 'Finance', readModelKey: 'finance.doc-flow', monitoringTitle: 'Documents in motion', cameraId: 'CAM-FIN-01', headEmail: 'head-finance@ubi.ph', headName: 'V. Santos' },
];

export interface StandardKpi {
  label: string;
  value: string;
  sub: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}

export interface DeptDashboard {
  slug: string;
  label: string;
  head: { email: string; name: string };
  /** STANDARD across every department — same four cards everywhere. */
  kpis: StandardKpi[];
  monitoring: { title: string; src: string; data: unknown };
  /** CCTV thumbnail meta. online=false until an NVR/stream is wired (IT spec). */
  camera: { id: string; label: string; online: boolean; streamUrl: string | null };
}

@Injectable()
export class DeptService {
  constructor(
    private readonly registry: ReadModelRegistry,
    private readonly approvals: ApprovalsService,
  ) {}

  list(): DeptDef[] {
    return DEPARTMENTS;
  }

  private countAttention(slug: string, data: unknown): { n: number; note: string; tone: StandardKpi['tone'] } {
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    if (slug === 'it') {
      const n = rows.filter((r) => r.status === 'amber' || r.status === 'red').length;
      return { n, note: 'resources amber/red', tone: n ? 'warn' : 'ok' };
    }
    if (slug === 'audit') {
      const n = rows.filter((r) => r.status === 'escalated').length;
      return { n, note: 'escalated exceptions', tone: n ? 'bad' : 'ok' };
    }
    if (slug === 'mqc') {
      const n = rows.filter((r) => r.status === 'pending').length;
      return { n, note: 'certs pending', tone: n ? 'warn' : 'ok' };
    }
    if (slug === 'records') {
      return { n: rows.length, note: 'expiring ≤30 days', tone: rows.length ? 'warn' : 'ok' };
    }
    return { n: 0, note: 'all clear', tone: 'ok' };
  }

  async dashboard(user: UserClaims, slug: string): Promise<DeptDashboard> {
    const def = DEPARTMENTS.find((d) => d.slug === slug);
    if (!def) throw new NotFoundException(`unknown department: ${slug}`);

    // RBAC: that dept's head/staff, or cross-cutting exec/admin.
    const allowed =
      hasClaim(user, 'role:ceo') ||
      hasClaim(user, 'role:vpo') ||
      hasClaim(user, 'role:admin') ||
      hasClaim(user, `dept:${slug}`);
    if (!allowed) throw new ForbiddenException(`requires dept:${slug} or executive scope`);

    const model = this.registry.get(def.readModelKey);
    const data = model ? await model.handler(user) : null;
    const monitored = Array.isArray(data) ? data.length : data && typeof data === 'object' ? Object.keys(data).length : 0;

    const feed = seedReportFeed().filter((r) => r.module === slug);
    const onTime = feed.filter((r) => r.status === 'on-time' || r.status === 'received').length;
    const reportTone: StandardKpi['tone'] = feed.some((r) => r.status === 'late')
      ? 'bad'
      : feed.some((r) => r.status === 'pending')
        ? 'warn'
        : 'ok';

    const pendingApprovals = await this.approvals.countPending();
    const attention = this.countAttention(slug, data);

    const kpis: StandardKpi[] = [
      { label: 'Monitored items', value: String(monitored), sub: def.monitoringTitle, tone: 'info' },
      { label: 'Reporting', value: feed.length ? `${onTime}/${feed.length}` : '—', sub: 'on-time this period', tone: reportTone },
      { label: 'Open approvals', value: String(pendingApprovals), sub: 'in shared engine', tone: pendingApprovals ? 'warn' : 'ok' },
      { label: 'Needs attention', value: String(attention.n), sub: attention.note, tone: attention.tone },
    ];

    const base = process.env.CCTV_BASE_URL?.replace(/\/$/, '');
    return {
      slug: def.slug,
      label: def.label,
      head: { email: def.headEmail, name: def.headName },
      kpis,
      monitoring: { title: def.monitoringTitle, src: def.readModelKey, data },
      camera: {
        id: def.cameraId,
        label: `${def.label} · ${def.cameraId}`,
        online: Boolean(base),
        streamUrl: base ? `${base}/${def.cameraId}/snapshot.jpg` : null,
      },
    };
  }
}

@Controller('dept')
export class DeptController {
  constructor(private readonly svc: DeptService) {}

  @Get()
  list(): DeptDef[] {
    return this.svc.list();
  }

  @Get(':slug/dashboard')
  dashboard(@CurrentUser() user: UserClaims, @Param('slug') slug: string): Promise<DeptDashboard> {
    return this.svc.dashboard(user, slug);
  }
}

@Module({
  controllers: [DeptController],
  providers: [DeptService],
  exports: [DeptService],
})
export class DeptModule {}
