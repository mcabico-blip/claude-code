import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { DocumentEntity } from './document.entity';

@Entity('document_movement')
export class DocumentMovementEntity extends BaseAppEntity {
  @Index()
  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => DocumentEntity, (d) => d.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: DocumentEntity;

  @Column({ name: 'from_party' })
  from: string;

  @Column({ name: 'to_party' })
  to: string;

  @Column()
  by: string;

  @Column({ type: 'varchar' })
  kind: 'transmit' | 'receive' | 'create';

  @Column({ type: 'varchar', nullable: true })
  note: string | null;
}
