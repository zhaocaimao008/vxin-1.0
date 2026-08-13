import { Repository } from 'typeorm';
import { Moment, MomentComment, MomentLike } from './entities/moment.entity';
export declare class MomentsService {
    private readonly moments;
    private readonly comments;
    private readonly likes;
    constructor(moments: Repository<Moment>, comments: Repository<MomentComment>, likes: Repository<MomentLike>);
    create(userId: string, content: string, mediaUrls?: string[]): Promise<Moment>;
    feed(page?: number, limit?: number): Promise<{
        items: Moment[];
        total: number;
    }>;
    userMoments(userId: string, page?: number, limit?: number): Promise<Moment[]>;
    addComment(userId: string, momentId: string, content: string): Promise<MomentComment>;
    toggleLike(userId: string, momentId: string): Promise<{
        liked: boolean;
    }>;
    delete(userId: string, momentId: string): Promise<void>;
}
