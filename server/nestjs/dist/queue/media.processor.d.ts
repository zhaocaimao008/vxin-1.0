import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
export declare class MediaProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job): Promise<unknown>;
    private compressImage;
    private processVideo;
}
