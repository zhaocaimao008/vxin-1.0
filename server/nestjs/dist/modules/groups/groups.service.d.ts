import { Repository } from 'typeorm';
import { Group, GroupMember } from './entities/group.entity';
export declare class GroupsService {
    private readonly groups;
    private readonly members;
    constructor(groups: Repository<Group>, members: Repository<GroupMember>);
    create(ownerId: string, name: string): Promise<Group>;
    findById(id: string, userId: string): Promise<Group>;
    listMyGroups(userId: string): Promise<Group[]>;
    invite(inviterId: string, groupId: string, targetUserId: string): Promise<GroupMember>;
    leave(userId: string, groupId: string): Promise<void>;
    updateGroup(userId: string, groupId: string, dto: {
        name?: string;
        announcement?: string;
    }): Promise<Group>;
    removeMember(adminId: string, groupId: string, targetUserId: string): Promise<void>;
    isMember(groupId: string, userId: string): Promise<boolean>;
    private assertMember;
    private assertAdmin;
}
