import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, GroupMember, GroupMemberRole } from './entities/group.entity';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember) private readonly members: Repository<GroupMember>,
  ) {}

  async create(ownerId: string, name: string): Promise<Group> {
    const group = this.groups.create({ name, ownerId });
    const saved = await this.groups.save(group);

    const member = this.members.create({ groupId: saved.id, userId: ownerId, role: GroupMemberRole.OWNER });
    await this.members.save(member);

    return this.findById(saved.id, ownerId);
  }

  async findById(id: string, userId: string): Promise<Group> {
    const group = await this.groups.findOne({ where: { id }, relations: ['members', 'members.user'] });
    if (!group || !group.isActive) throw new NotFoundException('Group not found');
    await this.assertMember(id, userId);
    return group;
  }

  async listMyGroups(userId: string): Promise<Group[]> {
    const memberships = await this.members.find({ where: { userId }, relations: ['group'] });
    return memberships.filter((m) => m.group?.isActive).map((m) => m.group);
  }

  async invite(inviterId: string, groupId: string, targetUserId: string): Promise<GroupMember> {
    await this.assertMember(groupId, inviterId);
    const exists = await this.members.findOne({ where: { groupId, userId: targetUserId } });
    if (exists) throw new BadRequestException('User already in group');

    const member = this.members.create({ groupId, userId: targetUserId, role: GroupMemberRole.MEMBER });
    return this.members.save(member);
  }

  async leave(userId: string, groupId: string): Promise<void> {
    const member = await this.members.findOne({ where: { groupId, userId } });
    if (!member) throw new NotFoundException('Not a group member');

    const group = await this.groups.findOne({ where: { id: groupId } });
    if (group?.ownerId === userId) throw new BadRequestException('Owner must transfer ownership before leaving');

    await this.members.remove(member);
  }

  async updateGroup(userId: string, groupId: string, dto: { name?: string; announcement?: string }): Promise<Group> {
    await this.assertAdmin(groupId, userId);
    await this.groups.update(groupId, dto);
    return this.findById(groupId, userId);
  }

  async removeMember(adminId: string, groupId: string, targetUserId: string): Promise<void> {
    await this.assertAdmin(groupId, adminId);
    if (adminId === targetUserId) throw new BadRequestException('Use leave endpoint to exit');

    const member = await this.members.findOne({ where: { groupId, userId: targetUserId } });
    if (!member) throw new NotFoundException('Member not found');
    await this.members.remove(member);
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const m = await this.members.findOne({ where: { groupId, userId } });
    return !!m;
  }

  private async assertMember(groupId: string, userId: string): Promise<GroupMember> {
    const m = await this.members.findOne({ where: { groupId, userId } });
    if (!m) throw new ForbiddenException('Not a group member');
    return m;
  }

  private async assertAdmin(groupId: string, userId: string): Promise<GroupMember> {
    const m = await this.assertMember(groupId, userId);
    if (m.role === GroupMemberRole.MEMBER) throw new ForbiddenException('Admin only');
    return m;
  }
}
