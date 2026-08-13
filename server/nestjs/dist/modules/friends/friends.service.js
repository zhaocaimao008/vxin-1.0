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
exports.FriendsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const friendship_entity_1 = require("./entities/friendship.entity");
let FriendsService = class FriendsService {
    constructor(repo) {
        this.repo = repo;
    }
    async sendRequest(requesterId, addresseeId) {
        if (requesterId === addresseeId)
            throw new common_1.BadRequestException('Cannot add yourself');
        const existing = await this.repo.findOne({
            where: [
                { requesterId, addresseeId },
                { requesterId: addresseeId, addresseeId: requesterId },
            ],
        });
        if (existing)
            throw new common_1.ConflictException('Friend request already exists');
        const f = this.repo.create({ requesterId, addresseeId, status: friendship_entity_1.FriendshipStatus.PENDING });
        return this.repo.save(f);
    }
    async accept(currentUserId, friendshipId) {
        const f = await this.repo.findOne({ where: { id: friendshipId, addresseeId: currentUserId } });
        if (!f)
            throw new common_1.NotFoundException('Friend request not found');
        if (f.status !== friendship_entity_1.FriendshipStatus.PENDING)
            throw new common_1.BadRequestException('Request already handled');
        f.status = friendship_entity_1.FriendshipStatus.ACCEPTED;
        return this.repo.save(f);
    }
    async decline(currentUserId, friendshipId) {
        const f = await this.repo.findOne({ where: { id: friendshipId, addresseeId: currentUserId } });
        if (!f)
            throw new common_1.NotFoundException('Friend request not found');
        await this.repo.remove(f);
    }
    async block(currentUserId, friendshipId) {
        const f = await this.repo.findOne({
            where: [
                { id: friendshipId, requesterId: currentUserId },
                { id: friendshipId, addresseeId: currentUserId },
            ],
        });
        if (!f)
            throw new common_1.NotFoundException('Friendship not found');
        f.status = friendship_entity_1.FriendshipStatus.BLOCKED;
        return this.repo.save(f);
    }
    async listFriends(userId) {
        return this.repo.find({
            where: [
                { requesterId: userId, status: friendship_entity_1.FriendshipStatus.ACCEPTED },
                { addresseeId: userId, status: friendship_entity_1.FriendshipStatus.ACCEPTED },
            ],
        });
    }
    async listPending(userId) {
        return this.repo.find({ where: { addresseeId: userId, status: friendship_entity_1.FriendshipStatus.PENDING } });
    }
    async areFriends(userA, userB) {
        const f = await this.repo.findOne({
            where: [
                { requesterId: userA, addresseeId: userB, status: friendship_entity_1.FriendshipStatus.ACCEPTED },
                { requesterId: userB, addresseeId: userA, status: friendship_entity_1.FriendshipStatus.ACCEPTED },
            ],
        });
        return !!f;
    }
};
exports.FriendsService = FriendsService;
exports.FriendsService = FriendsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(friendship_entity_1.Friendship)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FriendsService);
//# sourceMappingURL=friends.service.js.map