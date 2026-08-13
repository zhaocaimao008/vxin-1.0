import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  OneToMany, CreateDateColumn, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('moments')
@Index(['userId', 'createdAt'])
export class Moment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: [] })
  mediaUrls: string[];

  @Column({ default: 0 })
  likeCount: number;

  @Column({ default: true })
  isVisible: boolean;

  @OneToMany(() => MomentComment, (c) => c.moment, { cascade: true })
  comments: MomentComment[];

  @OneToMany(() => MomentLike, (l) => l.moment, { cascade: true })
  likes: MomentLike[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('moment_comments')
export class MomentComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  momentId: string;

  @Column()
  userId: string;

  @ManyToOne(() => Moment, (m) => m.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'momentId' })
  moment: Moment;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('moment_likes')
export class MomentLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  momentId: string;

  @Column()
  userId: string;

  @ManyToOne(() => Moment, (m) => m.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'momentId' })
  moment: Moment;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
