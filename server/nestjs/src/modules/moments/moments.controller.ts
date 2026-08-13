import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MomentsService } from './moments.service';

@ApiTags('moments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('moments')
export class MomentsController {
  constructor(private readonly svc: MomentsService) {}

  @Get('feed')
  feed(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.feed(page ? +page : 1, limit ? +limit : 20);
  }

  @Get('user/:userId')
  userMoments(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.userMoments(userId, page ? +page : 1, limit ? +limit : 20);
  }

  @Post()
  create(@Request() req, @Body() dto: { content: string; mediaUrls?: string[] }) {
    return this.svc.create(req.user.id, dto.content, dto.mediaUrls);
  }

  @Post(':id/comments')
  comment(@Request() req, @Param('id') id: string, @Body() dto: { content: string }) {
    return this.svc.addComment(req.user.id, id, dto.content);
  }

  @Post(':id/like')
  like(@Request() req, @Param('id') id: string) {
    return this.svc.toggleLike(req.user.id, id);
  }

  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.svc.delete(req.user.id, id);
  }
}
