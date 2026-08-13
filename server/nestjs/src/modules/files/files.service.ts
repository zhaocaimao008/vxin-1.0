import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME: Record<string, string> = {
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

@Injectable()
export class FilesService {
  constructor(
    @InjectQueue('media') private readonly mediaQueue: Queue,
  ) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async saveUpload(file: Express.Multer.File, uploaderId: string): Promise<{ url: string; key: string; mime: string }> {
    if (file.size > MAX_SIZE) throw new BadRequestException('File too large (max 100 MB)');

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Unsupported file type');

    const key = `${uuidv4()}${ext}`;
    const dest = path.join(UPLOAD_DIR, key);
    fs.renameSync(file.path, dest);

    if (file.mimetype.startsWith('image/')) {
      await this.mediaQueue.add('compress-image', { key, dest, uploaderId });
    } else if (file.mimetype.startsWith('video/')) {
      await this.mediaQueue.add('process-video', { key, dest, uploaderId });
    }

    const baseUrl = process.env.CDN_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return { url: `${baseUrl}/files/${key}`, key, mime: file.mimetype };
  }

  resolveLocalPath(key: string): string {
    return path.join(UPLOAD_DIR, path.basename(key));
  }
}
