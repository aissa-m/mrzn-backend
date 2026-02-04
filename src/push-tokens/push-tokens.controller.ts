import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PushTokensService } from './push-tokens.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensService) {}

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
}
