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
var PushProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const node_pushnotifications_1 = require("node-pushnotifications");
const settings = {
    gcm: {
        id: process.env.FCM_SERVER_KEY || '',
    },
    apn: {
        token: {
            key: process.env.APN_KEY_PATH || '',
            keyId: process.env.APN_KEY_ID || '',
            teamId: process.env.APN_TEAM_ID || '',
        },
        production: process.env.NODE_ENV === 'production',
    },
};
let PushProcessor = PushProcessor_1 = class PushProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super();
        this.logger = new common_1.Logger(PushProcessor_1.name);
        this.push = new node_pushnotifications_1.default(settings);
    }
    async process(job) {
        const { tokens, title, body, data, badge } = job.data;
        if (!tokens?.length)
            return;
        const msg = {
            title,
            body,
            badge: badge ?? 1,
            custom: data ?? {},
            sound: 'default',
            topic: process.env.APN_BUNDLE_ID || 'com.vxin.app',
        };
        try {
            const results = await this.push.send(tokens, msg);
            const failures = results.filter(r => r.failure > 0);
            if (failures.length) {
                this.logger.warn(`Push failures: ${JSON.stringify(failures)}`);
            }
            else {
                this.logger.log(`Push sent to ${tokens.length} device(s): ${title}`);
            }
        }
        catch (err) {
            this.logger.error('Push send error', err);
            throw err;
        }
    }
};
exports.PushProcessor = PushProcessor;
exports.PushProcessor = PushProcessor = PushProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('push'),
    __metadata("design:paramtypes", [])
], PushProcessor);
//# sourceMappingURL=push.processor.js.map