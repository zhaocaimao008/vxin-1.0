import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
export interface PushPayload {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string | number>;
    badge?: number;
}
export declare class PushProcessor extends WorkerHost {
    private readonly logger;
    private push;
    constructor();
    process(job: Job<PushPayload>): Promise<void>;
}
