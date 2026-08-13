import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Moment, MomentComment, MomentLike } from './entities/moment.entity';
import { MomentsService } from './moments.service';
import { MomentsController } from './moments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Moment, MomentComment, MomentLike])],
  providers: [MomentsService],
  controllers: [MomentsController],
  exports: [MomentsService],
})
export class MomentsModule {}
