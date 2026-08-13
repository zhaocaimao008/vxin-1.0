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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const message_entity_1 = require("./entities/message.entity");
let MessagesService = class MessagesService {
    constructor(repo) {
        this.repo = repo;
    }
    async send(senderId, dto) {
        const msg = this.repo.create({ senderId, ...dto });
        const saved = await this.repo.save(msg);
        return this.repo.findOne({ where: { id: saved.id }, relations: ['sender'] });
    }
    async getHistory(conversationType, conversationId, before, limit = 50) {
        const where = { conversationType, conversationId };
        if (before)
            where.createdAt = (0, typeorm_2.LessThan)(before);
        return this.repo.find({
            where,
            order: { createdAt: 'DESC' },
            take: Math.min(limit, 100),
            relations: ['sender'],
        });
    }
    async recall(userId, messageId) {
        const msg = await this.repo.findOne({ where: { id: messageId } });
        if (!msg)
            throw new common_1.NotFoundException('Message not found');
        if (msg.senderId !== userId)
            throw new common_1.ForbiddenException('Cannot recall others\' messages');
        const ageMs = Date.now() - msg.createdAt.getTime();
        if (ageMs > 2 * 60 * 1000)
            throw new common_1.ForbiddenException('Can only recall messages within 2 minutes');
        msg.isRecalled = true;
        msg.content = '';
        msg.type = message_entity_1.MessageType.RECALL;
        return this.repo.save(msg);
    }
    async getUnread(userId, since) {
        return this.repo
            .createQueryBuilder('m')
            .where('m.createdAt > :since', { since })
            .andWhere('(m.conversationType = :private AND m.conversationId IN (:...convIds))', { private: message_entity_1.ConversationType.PRIVATE, convIds: [userId] })
            .orderBy('m.createdAt', 'ASC')
            .limit(200)
            .getMany();
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.Message)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MessagesService);
//# sourceMappingURL=messages.service.js.map