import { Column, Entity, Index } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';

@Entity('app_user')
export class UserEntity extends BaseAppEntity {
  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  name: string;

  /** Null when the account is Google-only. */
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  /** Linked Google subject id, when "Sign in with Google" is attached. */
  @Column({ name: 'google_sub', type: 'varchar', nullable: true })
  googleSub: string | null;

  /** dept:engineering, role:manager, scope:project-<id>, role:ceo … */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  claims: string[];

  /** Field roles get long offline grace; office-sensitive roles short sessions. */
  @Column({ name: 'is_field', default: false })
  isField: boolean;
}
