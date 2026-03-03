import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PushTokensService } from './push-tokens.service';
import { ExpoPushService } from './expo-push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/auth.types';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('push-tokens')
export class PushTokensController {
  constructor(
    private readonly pushTokens: PushTokensService,
    private readonly expoPush: ExpoPushService,
  ) {}

  @Post('register')
  register(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.pushTokens.register(user, dto.token, dto.platform);
  }

  @Post('unregister')
  unregister(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    return this.pushTokens.unregister(user, dto.token);
  }

  /**
   * Dev only: debug info for current user's push tokens (count, suffix, enabled).
   */
  @Get('debug')
  async debug(@CurrentUser() user: JwtUserPayload) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Debug endpoint is not available in production');
    }
    return this.expoPush.debugUserTokens(user.id);
  }
}
