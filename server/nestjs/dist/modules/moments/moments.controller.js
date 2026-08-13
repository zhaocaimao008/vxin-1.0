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
exports.MomentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const moments_service_1 = require("./moments.service");
let MomentsController = class MomentsController {
    constructor(svc) {
        this.svc = svc;
    }
    feed(page, limit) {
        return this.svc.feed(page ? +page : 1, limit ? +limit : 20);
    }
    userMoments(userId, page, limit) {
        return this.svc.userMoments(userId, page ? +page : 1, limit ? +limit : 20);
    }
    create(req, dto) {
        return this.svc.create(req.user.id, dto.content, dto.mediaUrls);
    }
    comment(req, id, dto) {
        return this.svc.addComment(req.user.id, id, dto.content);
    }
    like(req, id) {
        return this.svc.toggleLike(req.user.id, id);
    }
    delete(req, id) {
        return this.svc.delete(req.user.id, id);
    }
};
exports.MomentsController = MomentsController;
__decorate([
    (0, common_1.Get)('feed'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "feed", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "userMoments", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "comment", null);
__decorate([
    (0, common_1.Post)(':id/like'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "like", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MomentsController.prototype, "delete", null);
exports.MomentsController = MomentsController = __decorate([
    (0, swagger_1.ApiTags)('moments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('moments'),
    __metadata("design:paramtypes", [moments_service_1.MomentsService])
], MomentsController);
//# sourceMappingURL=moments.controller.js.map