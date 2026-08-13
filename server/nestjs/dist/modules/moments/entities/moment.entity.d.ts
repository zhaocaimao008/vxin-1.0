import { User } from '../../users/entities/user.entity';
export declare class Moment {
    id: string;
    userId: string;
    user: User;
    content: string;
    mediaUrls: string[];
    likeCount: number;
    isVisible: boolean;
    comments: MomentComment[];
    likes: MomentLike[];
    createdAt: Date;
}
export declare class MomentComment {
    id: string;
    momentId: string;
    userId: string;
    moment: Moment;
    user: User;
    content: string;
    createdAt: Date;
}
export declare class MomentLike {
    id: string;
    momentId: string;
    userId: string;
    moment: Moment;
    user: User;
    createdAt: Date;
}
