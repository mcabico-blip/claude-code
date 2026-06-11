import { Column, Entity, Index } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';

export interface ApprovalStepState {
  /** e.g. 'pe' | 'pm' | 'vpo' — labels are flow-specific. */
  step: string;
  /** Claim that may act on this step, e.g. 'role:pm'. */
  actorClaim: string;
  status: 'pending' | 'approved' | 'returned';
  by: string | null;
  at: string | null;
  note: string | null;
}

/**
 * Shared approvals engine — materials schedules, subcontracts, PRs all use
 * the same chain shape (build once, reuse everywhere).
 */
@Entity('approval')
export class ApprovalEntity extends BaseAppEntity {
  /** e.g. 'materials-schedule' */
  @Index()
  @Column({ name: 'subject_type' })
  subjectType: string;

  @Index()
  @Column({ name: 'subject_id' })
  subjectId: string;

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  chain: ApprovalStepState[];

  @Column({ name: 'current_step', type: 'int', default: 0 })
  currentStep: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'approved' | 'returned';
}
