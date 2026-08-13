import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async create(data: {
    phone: string;
    username: string;
    nickname: string;
    password: string;
  }): Promise<User> {
    const exists = await this.repo.findOne({
      where: [{ phone: data.phone }, { username: data.username }],
    });
    if (exists) throw new ConflictException('Phone or username already taken');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = this.repo.create({ ...data, passwordHash, nickname: data.nickname || data.username });
    return this.repo.save(user);
  }

  async updateProfile(id: string, dto: Partial<Pick<User, 'nickname' | 'avatar' | 'bio' | 'gender'>>): Promise<User> {
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async setOnline(id: string, online: boolean): Promise<void> {
    await this.repo.update(id, {
      isOnline: online,
      lastSeenAt: online ? undefined : new Date(),
    });
  }

  async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    return this.repo
      .createQueryBuilder('u')
      .where('(u.username ILIKE :q OR u.nickname ILIKE :q OR u.phone = :exact)')
      .andWhere('u.id != :me')
      .andWhere('u.isActive = true')
      .setParameters({ q: `%${query}%`, exact: query, me: currentUserId })
      .limit(20)
      .getMany();
  }
}
