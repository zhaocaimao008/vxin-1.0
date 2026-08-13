import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 32 })
  username: string;

  @Column({ unique: true, length: 128 })
  phone: string;

  @Column({ nullable: true, length: 128 })
  email: string;

  @Column({ length: 64, default: '' })
  nickname: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ length: 256, default: '' })
  bio: string;

  @Column({ default: 0 })
  gender: number;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastSeenAt: Date;

  @Column({ default: false })
  isOnline: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
