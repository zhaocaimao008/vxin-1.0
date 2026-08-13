import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  VIDEO = 'video',
  FILE = 'file',
  LOCATION = 'location',
  RECALL = 'recall',
}

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Entity('messages')
@Index(['conversationType', 'conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'enum', enum: ConversationType })
  conversationType: ConversationType;

  @Column()
  conversationId: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, unknown>;

  @Column({ nullable: true })
  replyToId: string;

  @Column({ default: false })
  isRecalled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
