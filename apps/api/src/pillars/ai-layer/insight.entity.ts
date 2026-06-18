import type { Severity } from '@ubi/types';
import { Column, Entity } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';

/**
 * Insights are GENERATED OFF-BOX (hard rule 1) and posted back here.
 * The box stores and serves results only.
 */
@Entity('insight')
export class InsightEntity extends BaseAppEntity {
  @Column({ type: 'varchar' })
  severity: Severity;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  evidence: string[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  actions: string[];

  @Column({ name: 'generated_by' })
  generatedBy: string;

  @Column({ default: false })
  dismissed: boolean;
}
