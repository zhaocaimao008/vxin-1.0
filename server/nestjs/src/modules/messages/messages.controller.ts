import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MessagesService, SendMessageDto } from './messages.service';
import { ConversationType } from './entities/message.entity';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly svc: MessagesService) {}

  @Post()
  send(@Request() req, @Body() dto: SendMessageDto) {
    return this.svc.send(req.user.id, dto);
  }

  @Get(':type/:conversationId')
  history(
    @Param('type') type: ConversationType,
    @Param('conversationId') conversationId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getHistory(
      type,
      conversationId,
      before ? new Date(before) : undefined,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Patch(':id/recall')
  recall(@Request() req, @Param('id') id: string) {
    return this.svc.recall(req.user.id, id);
  }
}
