import { Queue } from 'bullmq';
export declare class FilesService {
    private readonly mediaQueue;
    constructor(mediaQueue: Queue);
    saveUpload(file: Express.Multer.File, uploaderId: string): Promise<{
        url: string;
        key: string;
        mime: string;
    }>;
    resolveLocalPath(key: string): string;
}
