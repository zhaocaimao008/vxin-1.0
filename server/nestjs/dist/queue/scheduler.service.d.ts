import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Message } from '../modules/messages/entities/message.entity';
export declare class SchedulerService {
    private readonly mediaQueue;
    private readonly pushQueue;
    private readonly aiQueue;
    private readonly messageRepo;
    private readonly logger;
    constructor(mediaQueue: Queue, pushQueue: Queue, aiQueue: Queue, messageRepo: Repository<Message>);
    cleanQueues(): Promise<void>;
    purgeOldMessages(): Promise<void>;
    logQueueDepths(): Promise<void>;
}
