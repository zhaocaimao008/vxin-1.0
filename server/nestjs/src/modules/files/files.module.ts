import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'media' })],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
