import type { DocumentStatus } from '@ubi/types';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { DocumentMovementEntity } from './document-movement.entity';

@Entity('document')
export class DocumentEntity extends BaseAppEntity {
  /** Human/QR code, e.g. DOC-2026-04187 — what the label printer prints. */
  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column({ type: 'varchar', default: 'with-holder' })
  status: DocumentStatus;

  @Column({ name: 'current_holder' })
  currentHolder: string;

  @Column({ name: 'current_location' })
  currentLocation: string;

  @OneToMany(() => DocumentMovementEntity, (m) => m.document)
  movements: DocumentMovementEntity[];
}
