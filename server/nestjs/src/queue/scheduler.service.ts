import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Message } from '../modules/messages/entities/message.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('media') private readonly mediaQueue: Queue,
    @InjectQueue('push')  private readonly pushQueue: Queue,
    @InjectQueue('ai')    private readonly aiQueue: Queue,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
  ) {}

  // Clean up failed jobs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async cleanQueues() {
    const cleaned = await Promise.all([
      this.mediaQueue.clean(3600_000, 100, 'failed'),
      this.pushQueue.clean(3600_000,  100, 'failed'),
      this.aiQueue.clean(3600_000,    100, 'failed'),
    ]);
    this.logger.log(`Queue cleanup: ${cleaned.flat().length} failed jobs removed`);
  }

  // Delete messages older than 30 days (soft-deleted ones) at 3am
  @Cron('0 3 * * *')
  async purgeOldMessages() {
    const cutoff = new Date(Date.now() - 30 * 86400_000);
    const result = await this.messageRepo.delete({ createdAt: LessThan(cutoff), isRecalled: true });
    this.logger.log(`Purged ${result.affected ?? 0} old recalled messages`);
  }

  // Log queue depths every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async logQueueDepths() {
    const [mw, pw, aw] = await Promise.all([
      this.mediaQueue.getWaitingCount(),
      this.pushQueue.getWaitingCount(),
      this.aiQueue.getWaitingCount(),
    ]);
    if (mw + pw + aw > 0) {
      this.logger.log(`Queue depths — media:${mw} push:${pw} ai:${aw}`);
    }
  }
}
