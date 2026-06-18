import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  OnModuleInit,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import {
  Column,
  Entity,
  Repository,
} from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { Claims } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';
import { AiLayerModule } from '../../pillars/ai-layer/ai-layer.module';

// ──────────────────────── DPWH minimum testing rules ───────────────────────

/** Minimum DPWH testing requirements per pay item (from Blue Book). */
export const DPWH_TEST_RULES: Record<string, { test: string; per: string; qty: number }[]> = {
  '311(1)a': [
    { test: 'Slump test', per: 'truck', qty: 1 },
    { test: 'Air content', per: 'truck', qty: 1 },
    { test: 'Concrete cylinder (7-day)', per: '50 m³', qty: 2 },
    { test: 'Concrete cylinder (28-day)', per: '50 m³', qty: 2 },
  ],
  '311(1)b': [
    { test: 'Slump test', per: 'truck', qty: 1 },
    { test: 'Concrete beam (7-day)', per: '150 m³', qty: 2 },
    { test: 'Concrete beam (28-day)', per: '150 m³', qty: 2 },
  ],
  '311(1)c': [
    { test: 'Slump test', per: 'truck', qty: 1 },
    { test: 'Air content', per: 'truck', qty: 1 },
    { test: 'Concrete beam (7-day)', per: '150 m³', qty: 2 },
    { test: 'Concrete beam (14-day)', per: '150 m³', qty: 2 },
    { test: 'Concrete beam (28-day)', per: '150 m³', qty: 2 },
  ],
  '200': [
    { test: 'CBR laboratory', per: 'source change', qty: 1 },
    { test: 'Field density (nuclear)', per: '500 m²', qty: 1 },
  ],
  '201': [
    { test: 'Field density', per: '500 m²', qty: 1 },
    { test: 'Atterberg limits', per: 'source change', qty: 1 },
  ],
  '301': [
    { test: 'Gradation', per: 'lot', qty: 1 },
    { test: 'CBR', per: 'source change', qty: 1 },
    { test: 'Field density', per: '500 m²', qty: 1 },
  ],
};

// ──────────────────────────── Entities ────────────────────────────

/** A single QC test result. */
@Entity('mqc_test')
export class QcTest extends BaseAppEntity {
  @Column({ name: 'project_id', type: 'varchar' })
  projectId: string;

  /** DPWH pay-item number the test covers, e.g. "311(1)c". */
  @Column({ name: 'pay_item_no', type: 'varchar', length: 32 })
  payItemNo: string;

  @Column({ name: 'test_type', type: 'varchar', length: 64 })
  testType: string;

  /** Lab-assigned reference number. */
  @Column({ name: 'lab_ref', type: 'varchar', nullable: true })
  labRef: string | null;

  @Column({ name: 'cert_id', type: 'varchar', nullable: true })
  certId: string | null;

  /** passed | failed | pending */
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  result: string;

  @Column({ name: 'test_date', type: 'date', nullable: true })
  testDate: Date | null;

  /** Which billing batch this cert will attach to. */
  @Column({ name: 'billing_ref', type: 'varchar', nullable: true })
  billingRef: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}

/** Concrete pour log — standardised DPWH form. */
@Entity('mqc_pour_log')
export class PourLog extends BaseAppEntity {
  @Column({ name: 'project_id', type: 'varchar' })
  projectId: string;

  @Column({ name: 'pay_item_no', type: 'varchar', length: 32 })
  payItemNo: string;

  /** STA 0+000 format — location of the pour. */
  @Column({ name: 'station', type: 'varchar', length: 16, nullable: true })
  station: string | null;

  @Column({ name: 'pour_date', type: 'date' })
  pourDate: Date;

  /** Mix design code / specification. */
  @Column({ name: 'mix_design', type: 'varchar', length: 64, nullable: true })
  mixDesign: string | null;

  /** Volume poured (m³). */
  @Column({ name: 'volume_m3', type: 'numeric', precision: 10, scale: 3 })
  volumeM3: number;

  /** Slump mm at point of placement. */
  @Column({ name: 'slump_mm', type: 'numeric', precision: 6, scale: 1, nullable: true })
  slumpMm: number | null;

  @Column({ name: 'air_content_pct', type: 'numeric', precision: 4, scale: 2, nullable: true })
  airContentPct: number | null;

  @Column({ name: 'inspector_id', type: 'varchar', nullable: true })
  inspectorId: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}

/** Issued material certificate — attaches to a billing record via doc tracking. */
@Entity('mqc_material_cert')
export class MaterialCert extends BaseAppEntity {
  @Column({ name: 'cert_no', type: 'varchar', length: 32, unique: true })
  certNo: string;

  @Column({ name: 'project_id', type: 'varchar' })
  projectId: string;

  @Column({ name: 'pay_item_no', type: 'varchar', length: 32 })
  payItemNo: string;

  /** Billing reference the cert is attached to. */
  @Column({ name: 'billing_ref', type: 'varchar', nullable: true })
  billingRef: string | null;

  @Column({ name: 'issued_date', type: 'date' })
  issuedDate: Date;

  /** pending | issued | rejected */
  @Column({ type: 'varchar', length: 16, default: 'issued' })
  status: string;

  /** Path to the scanned cert file (via StorageProvider). */
  @Column({ name: 'file_path', type: 'varchar', nullable: true })
  filePath: string | null;
}

// ──────────────────────────── Service ────────────────────────────

@Injectable()
export class MqcService implements OnModuleInit {
  constructor(
    @InjectRepository(QcTest) private readonly tests: Repository<QcTest>,
    @InjectRepository(PourLog) private readonly pours: Repository<PourLog>,
    @InjectRepository(MaterialCert) private readonly certs: Repository<MaterialCert>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        key: 'mqc.certs',
        module: 'mqc',
        title: 'Material certificates queue',
        description: 'DPWH minimum testing per pay item; pending certs attach to billings.',
      },
      async () => {
        const pending = await this.tests.find({
          where: { result: 'pending' },
          order: { createdAt: 'ASC' },
        });
        return pending.map((t) => ({
          certId: t.certId ?? t.id.slice(0, 12).toUpperCase(),
          payItemNo: t.payItemNo,
          test: t.testType,
          status: t.result,
          daysPending: Math.floor((Date.now() - t.createdAt.getTime()) / 86_400_000),
          billing: t.billingRef ?? '—',
        }));
      },
    );
  }

  testRules(payItemNo: string) {
    return DPWH_TEST_RULES[payItemNo] ?? [];
  }

  async listTests(projectId: string, payItemNo?: string): Promise<QcTest[]> {
    const where: Record<string, unknown> = { projectId };
    if (payItemNo) where.payItemNo = payItemNo;
    return this.tests.find({ where, order: { testDate: 'DESC' } });
  }

  async submitTest(data: Partial<QcTest>, actor: string): Promise<QcTest> {
    const t = this.tests.create({ ...data, createdBy: actor });
    return this.tests.save(t);
  }

  async listPours(projectId: string): Promise<PourLog[]> {
    return this.pours.find({ where: { projectId }, order: { pourDate: 'DESC' } });
  }

  async submitPour(data: Partial<PourLog>, actor: string): Promise<PourLog> {
    const p = this.pours.create({ ...data, createdBy: actor });
    return this.pours.save(p);
  }

  async listCerts(projectId: string): Promise<MaterialCert[]> {
    return this.certs.find({ where: { projectId }, order: { issuedDate: 'DESC' } });
  }

  async issueCert(data: Partial<MaterialCert>, actor: string): Promise<MaterialCert> {
    const c = this.certs.create({ ...data, createdBy: actor });
    return this.certs.save(c);
  }
}

// ──────────────────────────── Controller ────────────────────────────

@Controller('mqc')
export class MqcController {
  constructor(private readonly mqc: MqcService) {}

  /** DPWH minimum testing requirements for a pay item. */
  @Get('rules/:payItemNo')
  rules(@Param('payItemNo') payItemNo: string) {
    return { payItemNo, requirements: this.mqc.testRules(payItemNo) };
  }

  @Get('projects/:projectId/tests')
  @Claims('dept:mqc', 'dept:engineering', 'role:manager', 'role:ceo', 'role:vpo')
  listTests(
    @Param('projectId') projectId: string,
    @Query('payItemNo') payItemNo?: string,
  ): Promise<QcTest[]> {
    return this.mqc.listTests(projectId, payItemNo);
  }

  @Post('projects/:projectId/tests')
  @Claims('dept:mqc', 'role:manager')
  submitTest(
    @Param('projectId') projectId: string,
    @Body() body: Partial<QcTest>,
  ): Promise<QcTest> {
    return this.mqc.submitTest({ ...body, projectId }, 'system');
  }

  @Get('projects/:projectId/pours')
  @Claims('dept:mqc', 'dept:engineering', 'role:manager', 'role:ceo', 'role:vpo')
  listPours(@Param('projectId') projectId: string): Promise<PourLog[]> {
    return this.mqc.listPours(projectId);
  }

  @Post('projects/:projectId/pours')
  @Claims('dept:mqc', 'role:manager')
  submitPour(
    @Param('projectId') projectId: string,
    @Body() body: Partial<PourLog>,
  ): Promise<PourLog> {
    return this.mqc.submitPour({ ...body, projectId }, 'system');
  }

  @Get('projects/:projectId/certs')
  @Claims('dept:mqc', 'dept:engineering', 'dept:billing', 'role:manager', 'role:ceo', 'role:vpo')
  listCerts(@Param('projectId') projectId: string): Promise<MaterialCert[]> {
    return this.mqc.listCerts(projectId);
  }

  @Post('projects/:projectId/certs')
  @Claims('dept:mqc', 'role:manager')
  issueCert(
    @Param('projectId') projectId: string,
    @Body() body: Partial<MaterialCert>,
  ): Promise<MaterialCert> {
    return this.mqc.issueCert({ ...body, projectId }, 'system');
  }
}

// ──────────────────────────── Module ────────────────────────────

@Module({
  imports: [
    TypeOrmModule.forFeature([QcTest, PourLog, MaterialCert]),
    AiLayerModule,
  ],
  controllers: [MqcController],
  providers: [MqcService],
  exports: [MqcService],
})
export class MqcModule {}
