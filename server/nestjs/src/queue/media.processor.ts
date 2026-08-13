import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

@Processor('media')
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  async process(job: Job): Promise<unknown> {
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

  private async compressImage(job: Job<{ key: string; dest: string }>): Promise<{ key: string }> {
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

  private async processVideo(job: Job<{ key: string; dest: string }>): Promise<{ key: string }> {
    const { key } = job.data;
    this.logger.log(`Video processing queued (ffmpeg): ${key}`);
    return { key };
  }
}
