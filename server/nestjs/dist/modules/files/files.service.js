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
exports.FilesService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const path = require("path");
const fs = require("fs");
const uuid_1 = require("uuid");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_SIZE = 100 * 1024 * 1024;
const ALLOWED_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.oga',
    'audio/webm': '.weba',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/octet-stream': '.bin',
};
let FilesService = class FilesService {
    constructor(mediaQueue) {
        this.mediaQueue = mediaQueue;
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    async saveUpload(file, uploaderId) {
        if (file.size > MAX_SIZE)
            throw new common_1.BadRequestException('File too large (max 100 MB)');
        const ext = ALLOWED_MIME[file.mimetype];
        if (!ext)
            throw new common_1.BadRequestException('Unsupported file type');
        const key = `${(0, uuid_1.v4)()}${ext}`;
        const dest = path.join(UPLOAD_DIR, key);
        fs.renameSync(file.path, dest);
        if (file.mimetype.startsWith('image/')) {
            await this.mediaQueue.add('compress-image', { key, dest, uploaderId });
        }
        else if (file.mimetype.startsWith('video/')) {
            await this.mediaQueue.add('process-video', { key, dest, uploaderId });
        }
        const baseUrl = process.env.CDN_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return { url: `${baseUrl}/files/${key}`, key, mime: file.mimetype };
    }
    resolveLocalPath(key) {
        return path.join(UPLOAD_DIR, path.basename(key));
    }
};
exports.FilesService = FilesService;
exports.FilesService = FilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('media')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], FilesService);
//# sourceMappingURL=files.service.js.map