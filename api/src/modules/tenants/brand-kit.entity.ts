import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'brand_kits', schema: 'platform' })
export class BrandKit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ name: 'logo_path', type: 'varchar', nullable: true })
  logoPath: string | null;

  @Column({ name: 'logo_mime', type: 'varchar', nullable: true })
  logoMime: string | null;

  @Column({ name: 'login_bg_path', type: 'varchar', nullable: true })
  loginBgPath: string | null;

  @Column({ name: 'login_bg_mime', type: 'varchar', nullable: true })
  loginBgMime: string | null;

  @Column({ name: 'is_starter', default: false })
  isStarter: boolean;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
