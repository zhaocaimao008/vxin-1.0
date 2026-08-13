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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const message_entity_1 = require("../modules/messages/entities/message.entity");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(mediaQueue, pushQueue, aiQueue, messageRepo) {
        this.mediaQueue = mediaQueue;
        this.pushQueue = pushQueue;
        this.aiQueue = aiQueue;
        this.messageRepo = messageRepo;
        this.logger = new common_1.Logger(SchedulerService_1.name);
    }
    async cleanQueues() {
        const cleaned = await Promise.all([
            this.mediaQueue.clean(3600_000, 100, 'failed'),
            this.pushQueue.clean(3600_000, 100, 'failed'),
            this.aiQueue.clean(3600_000, 100, 'failed'),
        ]);
        this.logger.log(`Queue cleanup: ${cleaned.flat().length} failed jobs removed`);
    }
    async purgeOldMessages() {
        const cutoff = new Date(Date.now() - 30 * 86400_000);
        const result = await this.messageRepo.delete({ createdAt: (0, typeorm_2.LessThan)(cutoff), isRecalled: true });
        this.logger.log(`Purged ${result.affected ?? 0} old recalled messages`);
    }
    async logQueueDepths() {
        const [mw, pw, aw] = await Promise.all([
            this.mediaQueue.getWaitingCount(),
            this.pushQueue.getWaitingCount(),
            this.aiQueue.getWaitingCount(),
        ]);
        if (mw + pw + aw > 0) {
            this.logger.log(`Queue depths — media:${mw} push:${pw} ai:${aw}`);
        }
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "cleanQueues", null);
__decorate([
    (0, schedule_1.Cron)('0 3 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "purgeOldMessages", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "logQueueDepths", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('media')),
    __param(1, (0, bullmq_1.InjectQueue)('push')),
    __param(2, (0, bullmq_1.InjectQueue)('ai')),
    __param(3, (0, typeorm_1.InjectRepository)(message_entity_1.Message)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue,
        typeorm_2.Repository])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map