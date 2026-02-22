import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { MoosylService } from './moosyl.service';
import { Request } from 'express';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks/moosyl')
export class MoosylWebhookController {
  constructor(private readonly moosyl: MoosylService) {}

  @Post()
  async handleWebhook(@Req() req: RequestWithRawBody) {
    const rawBody = req.rawBody ?? req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        'Raw body required for webhook signature verification. Configure bodyParser verify for /webhooks/moosyl.',
      );
    }
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const eventType = req.headers['x-webhook-event'] as string | undefined;

    await this.moosyl.handleWebhook(rawBody, signature, eventType);
    return { received: true };
  }
}
