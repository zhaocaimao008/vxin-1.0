import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Message, ConversationType, MessageType } from './entities/message.entity';

export interface SendMessageDto {
  conversationType: ConversationType;
  conversationId: string;
  type: MessageType;
  content: string;
  extra?: Record<string, unknown>;
  replyToId?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  async send(senderId: string, dto: SendMessageDto): Promise<Message> {
    const msg = this.repo.create({ senderId, ...dto });
    const saved = await this.repo.save(msg);
    return this.repo.findOne({ where: { id: saved.id }, relations: ['sender'] }) as Promise<Message>;
  }

  async getHistory(
    conversationType: ConversationType,
    conversationId: string,
    before?: Date,
    limit = 50,
  ): Promise<Message[]> {
    const where: any = { conversationType, conversationId };
    if (before) where.createdAt = LessThan(before);

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      relations: ['sender'],
    });
  }

  async recall(userId: string, messageId: string): Promise<Message> {
    const msg = await this.repo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Cannot recall others\' messages');

    const ageMs = Date.now() - msg.createdAt.getTime();
    if (ageMs > 2 * 60 * 1000) throw new ForbiddenException('Can only recall messages within 2 minutes');

    msg.isRecalled = true;
    msg.content = '';
    msg.type = MessageType.RECALL;
    return this.repo.save(msg);
  }

  async getUnread(userId: string, since: Date): Promise<Message[]> {
    return this.repo
      .createQueryBuilder('m')
      .where('m.createdAt > :since', { since })
      .andWhere(
        '(m.conversationType = :private AND m.conversationId IN (:...convIds))',
        { private: ConversationType.PRIVATE, convIds: [userId] },
      )
      .orderBy('m.createdAt', 'ASC')
      .limit(200)
      .getMany();
  }
}
