import { Controller, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('me')
  getMe(@Request() req) {
    return this.svc.findById(req.user.id);
  }

  @Get('search')
  search(@Query('q') q: string, @Request() req) {
    return this.svc.searchUsers(q ?? '', req.user.id);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch('me')
  updateMe(
    @Request() req,
    @Body() dto: { nickname?: string; bio?: string; gender?: number },
  ) {
    return this.svc.updateProfile(req.user.id, dto);
  }
}
