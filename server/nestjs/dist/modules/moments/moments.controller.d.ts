import { MomentsService } from './moments.service';
export declare class MomentsController {
    private readonly svc;
    constructor(svc: MomentsService);
    feed(page?: string, limit?: string): Promise<{
        items: import("./entities/moment.entity").Moment[];
        total: number;
    }>;
    userMoments(userId: string, page?: string, limit?: string): Promise<import("./entities/moment.entity").Moment[]>;
    create(req: any, dto: {
        content: string;
        mediaUrls?: string[];
    }): Promise<import("./entities/moment.entity").Moment>;
    comment(req: any, id: string, dto: {
        content: string;
    }): Promise<import("./entities/moment.entity").MomentComment>;
    like(req: any, id: string): Promise<{
        liked: boolean;
    }>;
    delete(req: any, id: string): Promise<void>;
}
