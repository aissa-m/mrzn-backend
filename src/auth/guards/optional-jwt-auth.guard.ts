import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

/**
 * JWT guard that does not require a token. If a valid Bearer token is present,
 * request.user is set; otherwise the request continues with user undefined.
 * Use for routes that support both anonymous and authenticated access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | undefined {
    if (err) return undefined;
    return user ?? undefined;
  }
}
