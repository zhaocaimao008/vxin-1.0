import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly svc: GroupsService) {}

  @Get()
  mine(@Request() req) {
    return this.svc.listMyGroups(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() dto: { name: string }) {
    return this.svc.create(req.user.id, dto.name);
  }

  @Get(':id')
  get(@Request() req, @Param('id') id: string) {
    return this.svc.findById(id, req.user.id);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: { name?: string; announcement?: string }) {
    return this.svc.updateGroup(req.user.id, id, dto);
  }

  @Post(':id/invite')
  invite(@Request() req, @Param('id') id: string, @Body() dto: { userId: string }) {
    return this.svc.invite(req.user.id, id, dto.userId);
  }

  @Delete(':id/leave')
  leave(@Request() req, @Param('id') id: string) {
    return this.svc.leave(req.user.id, id);
  }

  @Delete(':id/members/:userId')
  removeMember(@Request() req, @Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeMember(req.user.id, id, userId);
  }
}
