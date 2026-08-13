"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MediaProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
let MediaProcessor = MediaProcessor_1 = class MediaProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(MediaProcessor_1.name);
    }
    async process(job) {
        switch (job.name) {
            case 'compress-image':
                return this.compressImage(job);
            case 'process-video':
                return this.processVideo(job);
            default:
                this.logger.warn(`Unknown job: ${job.name}`);
                return null;
        }
    }
    async compressImage(job) {
        const { dest, key } = job.data;
        const ext = path.extname(dest).toLowerCase();
        const outPath = dest.replace(ext, `_c${ext}`);
        await sharp(dest)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82, progressive: true })
            .toFile(outPath);
        fs.renameSync(outPath, dest);
        this.logger.log(`Compressed image: ${key}`);
        return { key };
    }
    async processVideo(job) {
        const { key } = job.data;
        this.logger.log(`Video processing queued (ffmpeg): ${key}`);
        return { key };
    }
};
exports.MediaProcessor = MediaProcessor;
exports.MediaProcessor = MediaProcessor = MediaProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('media')
], MediaProcessor);
//# sourceMappingURL=media.processor.js.map