import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly svc: FriendsService) {}

  @Get()
  list(@Request() req) {
    return this.svc.listFriends(req.user.id);
  }

  @Get('pending')
  pending(@Request() req) {
    return this.svc.listPending(req.user.id);
  }

  @Post('request')
  sendRequest(@Request() req, @Body() dto: { addresseeId: string }) {
    return this.svc.sendRequest(req.user.id, dto.addresseeId);
  }

  @Patch(':id/accept')
  accept(@Request() req, @Param('id') id: string) {
    return this.svc.accept(req.user.id, id);
  }

  @Delete(':id/decline')
  decline(@Request() req, @Param('id') id: string) {
    return this.svc.decline(req.user.id, id);
  }

  @Patch(':id/block')
  block(@Request() req, @Param('id') id: string) {
    return this.svc.block(req.user.id, id);
  }
}
