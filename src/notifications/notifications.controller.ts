import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.notifications.list(user);
  }

  @Patch(':id/read')
  markOne(@CurrentUser() user: JwtUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user, id);
  }

  @Patch('read/all')
  markAll(@CurrentUser() user: JwtUserPayload) {
    return this.notifications.markAllRead(user);
  }
}
