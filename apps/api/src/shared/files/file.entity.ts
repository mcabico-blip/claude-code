import { Column, Entity, Index } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';

/** Postgres stores metadata + storage id ONLY — never binaries (hard rule 3). */
@Entity('file')
export class FileEntity extends BaseAppEntity {
  @Index({ unique: true })
  @Column({ name: 'storage_id' })
  storageId: string;

  @Column()
  filename: string;

  @Column({ name: 'content_type' })
  contentType: string;

  @Column({ type: 'int' })
  size: number;

  @Column()
  sha256: string;

  /** Owning context, e.g. "procurement:dr" or "engineering:progress-photo". */
  @Column()
  context: string;

  /** Claim required to fetch; RBAC is enforced at fetch time (hard rule 4). */
  @Column({ name: 'requires_claim', type: 'varchar', nullable: true })
  requiresClaim: string | null;
}
