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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MomentLike = exports.MomentComment = exports.Moment = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
let Moment = class Moment {
};
exports.Moment = Moment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Moment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Moment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", user_entity_1.User)
], Moment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Moment.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    __metadata("design:type", Array)
], Moment.prototype, "mediaUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Moment.prototype, "likeCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Moment.prototype, "isVisible", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => MomentComment, (c) => c.moment, { cascade: true }),
    __metadata("design:type", Array)
], Moment.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => MomentLike, (l) => l.moment, { cascade: true }),
    __metadata("design:type", Array)
], Moment.prototype, "likes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Moment.prototype, "createdAt", void 0);
exports.Moment = Moment = __decorate([
    (0, typeorm_1.Entity)('moments'),
    (0, typeorm_1.Index)(['userId', 'createdAt'])
], Moment);
let MomentComment = class MomentComment {
};
exports.MomentComment = MomentComment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MomentComment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MomentComment.prototype, "momentId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MomentComment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Moment, (m) => m.comments, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'momentId' }),
    __metadata("design:type", Moment)
], MomentComment.prototype, "moment", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", user_entity_1.User)
], MomentComment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MomentComment.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MomentComment.prototype, "createdAt", void 0);
exports.MomentComment = MomentComment = __decorate([
    (0, typeorm_1.Entity)('moment_comments')
], MomentComment);
let MomentLike = class MomentLike {
};
exports.MomentLike = MomentLike;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MomentLike.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MomentLike.prototype, "momentId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MomentLike.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Moment, (m) => m.likes, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'momentId' }),
    __metadata("design:type", Moment)
], MomentLike.prototype, "moment", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", user_entity_1.User)
], MomentLike.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MomentLike.prototype, "createdAt", void 0);
exports.MomentLike = MomentLike = __decorate([
    (0, typeorm_1.Entity)('moment_likes')
], MomentLike);
//# sourceMappingURL=moment.entity.js.map