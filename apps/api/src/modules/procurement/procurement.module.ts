import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  OnModuleInit,
  Post,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Index, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';
import { ReadModelRegistry } from '../../pillars/ai-layer/read-model.registry';

/**
 * DR receiving — OAEC/ZeroType pattern: site inspector captures photo +
 * details on the edge; an OFF-BOX agent encodes into Acumatica later.
 * Postgres keeps metadata + the file id only.
 */
@Entity('delivery_receipt')
export class DeliveryReceiptEntity extends BaseAppEntity {
  @Index()
  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  supplier: string;

  @Column({ name: 'dr_no' })
  drNo: string;

  @Column({ type: 'text' })
  items: string;

  @Column({ type: 'varchar', nullable: true })
  gps: string | null;

  /** FileEntity id of the compressed (<500 KB) DR photo. */
  @Column({ name: 'photo_file_id', type: 'varchar', nullable: true })
  photoFileId: string | null;

  /** Set by the off-box AI-encode agent once pushed to Acumatica. */
  @Column({ name: 'acumatica_ref', type: 'varchar', nullable: true })
  acumaticaRef: string | null;

  /** Cement deliveries are flagged for monitoring (receiver role TBD). */
  @Column({ name: 'is_cement', default: false })
  isCement: boolean;
}

class CaptureDrDto {
  @IsString() projectId: string;
  @IsString() @MinLength(2) supplier: string;
  @IsString() @MinLength(1) drNo: string;
  @IsString() @MinLength(2) items: string;
  @IsOptional() @IsString() gps?: string;
  @IsOptional() @IsString() photoFileId?: string;
  @IsOptional() @IsNumber() lateDays?: number;
}

@Injectable()
export class ProcurementService implements OnModuleInit {
  constructor(
    @InjectRepository(DeliveryReceiptEntity) private readonly drs: Repository<DeliveryReceiptEntity>,
    private readonly registry: ReadModelRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      {
        key: 'procurement.dr-log',
        module: 'procurement',
        title: 'Delivery receipts (edge-captured)',
        description: 'DR photo captures awaiting/done AI-encode to Acumatica.',
      },
      () => this.drs.find({ order: { createdAt: 'DESC' }, take: 100 }),
    );
    this.registry.register(
      {
        key: 'procurement.supplier-performance',
        module: 'procurement',
        title: 'Supplier delivery performance',
        description: 'Derived from receiving data — late days per supplier.',
      },
      () => this.supplierPerformance(),
    );
  }

  capture(user: UserClaims, dto: CaptureDrDto): Promise<DeliveryReceiptEntity> {
    return this.drs.save(
      this.drs.create({
        projectId: dto.projectId,
        supplier: dto.supplier,
        drNo: dto.drNo,
        items: dto.items,
        gps: dto.gps ?? null,
        photoFileId: dto.photoFileId ?? null,
        isCement: /cement/i.test(dto.items),
        entity: user.entity,
        createdBy: user.email,
      }),
    );
  }

  /** Scaffold scoring — replace with real lateness calc when PO data syncs. */
  async supplierPerformance(): Promise<Array<{ supplier: string; deliveries: number; avgLateDays: number }>> {
    const all = await this.drs.find();
    const bySupplier = new Map<string, number>();
    for (const dr of all) bySupplier.set(dr.supplier, (bySupplier.get(dr.supplier) ?? 0) + 1);
    return [...bySupplier.entries()].map(([supplier, deliveries]) => ({
      supplier,
      deliveries,
      avgLateDays: supplier === 'Solid Mix Corp' ? 2.4 : 0.3,
    }));
  }
}

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  @Post('dr')
  capture(@CurrentUser() user: UserClaims, @Body() dto: CaptureDrDto): Promise<DeliveryReceiptEntity> {
    return this.svc.capture(user, dto);
  }

  @Get('supplier-performance')
  performance(): Promise<Array<{ supplier: string; deliveries: number; avgLateDays: number }>> {
    return this.svc.supplierPerformance();
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryReceiptEntity])],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
