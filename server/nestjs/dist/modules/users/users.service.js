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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcryptjs");
const user_entity_1 = require("./entities/user.entity");
let UsersService = class UsersService {
    constructor(repo) {
        this.repo = repo;
    }
    async findById(id) {
        const user = await this.repo.findOne({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async findByPhone(phone) {
        return this.repo.findOne({ where: { phone } });
    }
    async findByUsername(username) {
        return this.repo.findOne({ where: { username } });
    }
    async create(data) {
        const exists = await this.repo.findOne({
            where: [{ phone: data.phone }, { username: data.username }],
        });
        if (exists)
            throw new common_1.ConflictException('Phone or username already taken');
        const passwordHash = await bcrypt.hash(data.password, 12);
        const user = this.repo.create({ ...data, passwordHash, nickname: data.nickname || data.username });
        return this.repo.save(user);
    }
    async updateProfile(id, dto) {
        await this.repo.update(id, dto);
        return this.findById(id);
    }
    async setOnline(id, online) {
        await this.repo.update(id, {
            isOnline: online,
            lastSeenAt: online ? undefined : new Date(),
        });
    }
    async searchUsers(query, currentUserId) {
        return this.repo
            .createQueryBuilder('u')
            .where('(u.username ILIKE :q OR u.nickname ILIKE :q OR u.phone = :exact)')
            .andWhere('u.id != :me')
            .andWhere('u.isActive = true')
            .setParameters({ q: `%${query}%`, exact: query, me: currentUserId })
            .limit(20)
            .getMany();
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map