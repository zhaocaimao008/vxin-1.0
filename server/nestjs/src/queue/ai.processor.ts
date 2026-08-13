import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as https from 'https';
import * as http from 'http';

const AI_BASE = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

async function postJson(url: string, body: unknown): Promise<unknown> {
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
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export interface AsrJobData  { fileUrl: string; language?: string; messageId: string; }
export interface ModJobData  { text: string; messageId: string; }
export interface LlmJobData  { messages: { role: string; content: string }[]; sessionId: string; }

@Processor('ai')
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case 'asr':        return this.runAsr(job as Job<AsrJobData>);
      case 'moderation': return this.runModeration(job as Job<ModJobData>);
      case 'llm':        return this.runLlm(job as Job<LlmJobData>);
      default:
        this.logger.warn(`Unknown AI job: ${job.name}`);
        return null;
    }
  }

  private async runAsr(job: Job<AsrJobData>) {
    const { fileUrl, language = 'auto', messageId } = job.data;
    this.logger.log(`ASR start: ${messageId}`);
    const result = await postJson(`${AI_BASE}/asr/transcribe-url`, { url: fileUrl, language });
    this.logger.log(`ASR done: ${messageId}`);
    return { messageId, result };
  }

  private async runModeration(job: Job<ModJobData>) {
    const { text, messageId } = job.data;
    const result = await postJson(`${AI_BASE}/moderation/check`, { text });
    this.logger.log(`Moderation done: ${messageId} → ${JSON.stringify(result)}`);
    return { messageId, result };
  }

  private async runLlm(job: Job<LlmJobData>) {
    const { messages, sessionId } = job.data;
    this.logger.log(`LLM job: ${sessionId}`);
    const result = await postJson(`${AI_BASE}/llm/chat`, { messages });
    return { sessionId, result };
  }
}
