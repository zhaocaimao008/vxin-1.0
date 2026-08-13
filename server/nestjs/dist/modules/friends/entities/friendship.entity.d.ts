import { User } from '../../users/entities/user.entity';
export declare enum FriendshipStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    BLOCKED = "blocked"
}
export declare class Friendship {
    id: string;
    requesterId: string;
    addresseeId: string;
    requester: User;
    addressee: User;
    status: FriendshipStatus;
    remark: string;
    createdAt: Date;
    updatedAt: Date;
}
