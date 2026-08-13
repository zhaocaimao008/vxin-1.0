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
exports.MomentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const moment_entity_1 = require("./entities/moment.entity");
let MomentsService = class MomentsService {
    constructor(moments, comments, likes) {
        this.moments = moments;
        this.comments = comments;
        this.likes = likes;
    }
    async create(userId, content, mediaUrls = []) {
        const moment = this.moments.create({ userId, content, mediaUrls });
        return this.moments.save(moment);
    }
    async feed(page = 1, limit = 20) {
        const [items, total] = await this.moments.findAndCount({
            where: { isVisible: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: Math.min(limit, 50),
            relations: ['user', 'comments', 'likes'],
        });
        return { items, total };
    }
    async userMoments(userId, page = 1, limit = 20) {
        return this.moments.find({
            where: { userId, isVisible: true },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: Math.min(limit, 50),
            relations: ['user', 'comments', 'likes'],
        });
    }
    async addComment(userId, momentId, content) {
        const moment = await this.moments.findOne({ where: { id: momentId } });
        if (!moment || !moment.isVisible)
            throw new common_1.NotFoundException('Moment not found');
        const comment = this.comments.create({ userId, momentId, content });
        return this.comments.save(comment);
    }
    async toggleLike(userId, momentId) {
        const moment = await this.moments.findOne({ where: { id: momentId } });
        if (!moment || !moment.isVisible)
            throw new common_1.NotFoundException('Moment not found');
        const existing = await this.likes.findOne({ where: { userId, momentId } });
        if (existing) {
            await this.likes.remove(existing);
            await this.moments.decrement({ id: momentId }, 'likeCount', 1);
            return { liked: false };
        }
        const like = this.likes.create({ userId, momentId });
        await this.likes.save(like);
        await this.moments.increment({ id: momentId }, 'likeCount', 1);
        return { liked: true };
    }
    async delete(userId, momentId) {
        const moment = await this.moments.findOne({ where: { id: momentId } });
        if (!moment)
            throw new common_1.NotFoundException('Moment not found');
        if (moment.userId !== userId)
            throw new common_1.ForbiddenException('Not your moment');
        await this.moments.remove(moment);
    }
};
exports.MomentsService = MomentsService;
exports.MomentsService = MomentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(moment_entity_1.Moment)),
    __param(1, (0, typeorm_1.InjectRepository)(moment_entity_1.MomentComment)),
    __param(2, (0, typeorm_1.InjectRepository)(moment_entity_1.MomentLike)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], MomentsService);
//# sourceMappingURL=moments.service.js.map