"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AiProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const https = require("https");
const http = require("http");
const AI_BASE = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
async function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
            let raw = '';
            res.on('data', c => { raw += c; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    resolve(raw);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}
let AiProcessor = AiProcessor_1 = class AiProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(AiProcessor_1.name);
    }
    async process(job) {
        switch (job.name) {
            case 'asr': return this.runAsr(job);
            case 'moderation': return this.runModeration(job);
            case 'llm': return this.runLlm(job);
            default:
                this.logger.warn(`Unknown AI job: ${job.name}`);
                return null;
        }
    }
    async runAsr(job) {
        const { fileUrl, language = 'auto', messageId } = job.data;
        this.logger.log(`ASR start: ${messageId}`);
        const result = await postJson(`${AI_BASE}/asr/transcribe-url`, { url: fileUrl, language });
        this.logger.log(`ASR done: ${messageId}`);
        return { messageId, result };
    }
    async runModeration(job) {
        const { text, messageId } = job.data;
        const result = await postJson(`${AI_BASE}/moderation/check`, { text });
        this.logger.log(`Moderation done: ${messageId} → ${JSON.stringify(result)}`);
        return { messageId, result };
    }
    async runLlm(job) {
        const { messages, sessionId } = job.data;
        this.logger.log(`LLM job: ${sessionId}`);
        const result = await postJson(`${AI_BASE}/llm/chat`, { messages });
        return { sessionId, result };
    }
};
exports.AiProcessor = AiProcessor;
exports.AiProcessor = AiProcessor = AiProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('ai')
], AiProcessor);
//# sourceMappingURL=ai.processor.js.map