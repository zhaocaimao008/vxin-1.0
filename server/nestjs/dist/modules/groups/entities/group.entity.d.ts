import { User } from '../../users/entities/user.entity';
export declare enum GroupMemberRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member"
}
export declare class Group {
    id: string;
    name: string;
    avatar: string;
    announcement: string;
    ownerId: string;
    owner: User;
    members: GroupMember[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class GroupMember {
    id: string;
    groupId: string;
    userId: string;
    group: Group;
    user: User;
    role: GroupMemberRole;
    alias: string;
    joinedAt: Date;
}
