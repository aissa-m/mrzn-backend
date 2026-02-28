import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  RawBodyRequest,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MoosylService } from './moosyl.service';
import { WalletTopupDto } from './dto/wallet-topup.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly moosyl: MoosylService) {}

  @Post('topup')
  async topup(
    @CurrentUser() user: { id: number },
    @Body() dto: WalletTopupDto,
  ) {
    return this.moosyl.createWalletTopup(user.id, dto.amount);
  }
}
