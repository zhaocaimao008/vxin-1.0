import { Response } from 'express';
import { FilesService } from './files.service';
export declare class FilesController {
    private readonly svc;
    constructor(svc: FilesService);
    upload(req: any, file: Express.Multer.File): Promise<{
        url: string;
        key: string;
        mime: string;
    }>;
    serve(key: string, res: Response): void | Response<any, Record<string, any>>;
}
