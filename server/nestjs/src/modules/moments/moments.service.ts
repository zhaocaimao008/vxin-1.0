import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Moment, MomentComment, MomentLike } from './entities/moment.entity';

@Injectable()
export class MomentsService {
  constructor(
    @InjectRepository(Moment) private readonly moments: Repository<Moment>,
    @InjectRepository(MomentComment) private readonly comments: Repository<MomentComment>,
    @InjectRepository(MomentLike) private readonly likes: Repository<MomentLike>,
  ) {}

  async create(userId: string, content: string, mediaUrls: string[] = []): Promise<Moment> {
    const moment = this.moments.create({ userId, content, mediaUrls });
    return this.moments.save(moment);
  }

  async feed(page = 1, limit = 20): Promise<{ items: Moment[]; total: number }> {
    const [items, total] = await this.moments.findAndCount({
      where: { isVisible: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 50),
      relations: ['user', 'comments', 'likes'],
    });
    return { items, total };
  }

  async userMoments(userId: string, page = 1, limit = 20): Promise<Moment[]> {
    return this.moments.find({
      where: { userId, isVisible: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 50),
      relations: ['user', 'comments', 'likes'],
    });
  }

  async addComment(userId: string, momentId: string, content: string): Promise<MomentComment> {
    const moment = await this.moments.findOne({ where: { id: momentId } });
    if (!moment || !moment.isVisible) throw new NotFoundException('Moment not found');

    const comment = this.comments.create({ userId, momentId, content });
    return this.comments.save(comment);
  }

  async toggleLike(userId: string, momentId: string): Promise<{ liked: boolean }> {
    const moment = await this.moments.findOne({ where: { id: momentId } });
    if (!moment || !moment.isVisible) throw new NotFoundException('Moment not found');

    const existing = await this.likes.findOne({ where: { userId, momentId } });
    if (existing) {
      await this.likes.remove(existing);
      await this.moments.decrement({ id: momentId }, 'likeCount', 1);
      return { liked: false };
    }

    const like = this.likes.create({ userId, momentId });
    await this.likes.save(like);
    await this.moments.increment({ id: momentId }, 'likeCount', 1);
    return { liked: true };
  }

  async delete(userId: string, momentId: string): Promise<void> {
    const moment = await this.moments.findOne({ where: { id: momentId } });
    if (!moment) throw new NotFoundException('Moment not found');
    if (moment.userId !== userId) throw new ForbiddenException('Not your moment');
    await this.moments.remove(moment);
  }
}
