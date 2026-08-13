"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const group_entity_1 = require("./entities/group.entity");
let GroupsService = class GroupsService {
    constructor(groups, members) {
        this.groups = groups;
        this.members = members;
    }
    async create(ownerId, name) {
        const group = this.groups.create({ name, ownerId });
        const saved = await this.groups.save(group);
        const member = this.members.create({ groupId: saved.id, userId: ownerId, role: group_entity_1.GroupMemberRole.OWNER });
        await this.members.save(member);
        return this.findById(saved.id, ownerId);
    }
    async findById(id, userId) {
        const group = await this.groups.findOne({ where: { id }, relations: ['members', 'members.user'] });
        if (!group || !group.isActive)
            throw new common_1.NotFoundException('Group not found');
        await this.assertMember(id, userId);
        return group;
    }
    async listMyGroups(userId) {
        const memberships = await this.members.find({ where: { userId }, relations: ['group'] });
        return memberships.filter((m) => m.group?.isActive).map((m) => m.group);
    }
    async invite(inviterId, groupId, targetUserId) {
        await this.assertMember(groupId, inviterId);
        const exists = await this.members.findOne({ where: { groupId, userId: targetUserId } });
        if (exists)
            throw new common_1.BadRequestException('User already in group');
        const member = this.members.create({ groupId, userId: targetUserId, role: group_entity_1.GroupMemberRole.MEMBER });
        return this.members.save(member);
    }
    async leave(userId, groupId) {
        const member = await this.members.findOne({ where: { groupId, userId } });
        if (!member)
            throw new common_1.NotFoundException('Not a group member');
        const group = await this.groups.findOne({ where: { id: groupId } });
        if (group?.ownerId === userId)
            throw new common_1.BadRequestException('Owner must transfer ownership before leaving');
        await this.members.remove(member);
    }
    async updateGroup(userId, groupId, dto) {
        await this.assertAdmin(groupId, userId);
        await this.groups.update(groupId, dto);
        return this.findById(groupId, userId);
    }
    async removeMember(adminId, groupId, targetUserId) {
        await this.assertAdmin(groupId, adminId);
        if (adminId === targetUserId)
            throw new common_1.BadRequestException('Use leave endpoint to exit');
        const member = await this.members.findOne({ where: { groupId, userId: targetUserId } });
        if (!member)
            throw new common_1.NotFoundException('Member not found');
        await this.members.remove(member);
    }
    async isMember(groupId, userId) {
        const m = await this.members.findOne({ where: { groupId, userId } });
        return !!m;
    }
    async assertMember(groupId, userId) {
        const m = await this.members.findOne({ where: { groupId, userId } });
        if (!m)
            throw new common_1.ForbiddenException('Not a group member');
        return m;
    }
    async assertAdmin(groupId, userId) {
        const m = await this.assertMember(groupId, userId);
        if (m.role === group_entity_1.GroupMemberRole.MEMBER)
            throw new common_1.ForbiddenException('Admin only');
        return m;
    }
};
exports.GroupsService = GroupsService;
exports.GroupsService = GroupsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(group_entity_1.Group)),
    __param(1, (0, typeorm_1.InjectRepository)(group_entity_1.GroupMember)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], GroupsService);
//# sourceMappingURL=groups.service.js.map