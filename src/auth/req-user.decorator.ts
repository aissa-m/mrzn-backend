// src/auth/decorators/req-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUserPayload } from './roles.guard';

export const ReqUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUserPayload;
  },
);
