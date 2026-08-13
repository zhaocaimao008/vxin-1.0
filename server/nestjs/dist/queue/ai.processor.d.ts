import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
export interface AsrJobData {
    fileUrl: string;
    language?: string;
    messageId: string;
}
export interface ModJobData {
    text: string;
    messageId: string;
}
export interface LlmJobData {
    messages: {
        role: string;
        content: string;
    }[];
    sessionId: string;
}
export declare class AiProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job): Promise<unknown>;
    private runAsr;
    private runModeration;
    private runLlm;
}
