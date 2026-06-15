import type { MaterialsScheduleLine, ScheduleStatus } from '@ubi/types';
import { Column, Entity, Index } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';

@Entity('project')
export class ProjectEntity extends BaseAppEntity {
  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ name: 'contract_no' })
  contractNo: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'bidding' | 'ntp' | 'active' | 'completed';

  @Column({ name: 'slippage_pct', type: 'real', default: 0 })
  slippagePct: number;

  /** In-house contract amount — denominator for accomplishment %. */
  @Column({ name: 'inhouse_amount', type: 'double precision', default: 0 })
  inhouseAmount: number;

  /** Project engineer / person-in-charge onsite. */
  @Column({ name: 'pe', type: 'varchar', default: '' })
  pe: string;

  /** Accomplishment carried in before the system started (so % + to-date are right). */
  @Column({ name: 'prior_accomplished', type: 'double precision', default: 0 })
  priorAccomplished: number;
}

/** Master DPWH Blue Book pay-item library — one library, reused everywhere. */
@Entity('pay_item')
export class PayItemEntity extends BaseAppEntity {
  @Index({ unique: true })
  @Column({ name: 'item_no' })
  itemNo: string;

  @Column()
  description: string;

  @Column()
  unit: string;
}

@Entity('materials_schedule')
export class MaterialsScheduleEntity extends BaseAppEntity {
  @Index()
  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'week_of', type: 'date' })
  weekOf: string;

  @Column({ type: 'jsonb' })
  lines: MaterialsScheduleLine[];

  @Column({ type: 'varchar', default: 'draft' })
  status: ScheduleStatus;

  @Column({ name: 'prepared_by' })
  preparedBy: string;
}
