import {
  Controller, Post, Get, Param, Res, UseGuards,
  Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FilesService } from './files.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, _file, cb) => cb(null, `tmp_${Date.now()}_${Math.random()}`),
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.svc.saveUpload(file, req.user.id);
  }

  @Get(':key')
  serve(@Param('key') key: string, @Res() res: Response) {
    const filePath = this.svc.resolveLocalPath(key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.sendFile(filePath);
  }
}
