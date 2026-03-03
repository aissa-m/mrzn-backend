// src/auth/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {



    try {
      const client = context.switchToWs().getClient<Socket>();

      const rawAuth = client.handshake.auth?.token;
      const rawQuery = (client.handshake.query as any)?.token;
      const rawHeader = client.handshake.headers?.authorization;

      console.log('[WS TOKEN PROBE] auth.token=', rawAuth ? String(rawAuth).slice(0, 30) : null);
      console.log('[WS TOKEN PROBE] query.token=', rawQuery ? String(rawQuery).slice(0, 30) : null);
      console.log('[WS TOKEN PROBE] header.auth=', rawHeader ? String(rawHeader).slice(0, 30) : null);

      const token = WsJwtGuard.extractToken(client);
      console.log('[WS TOKEN PROBE] normalized parts=', token?.split('.').length, 'len=', token?.length);
      // const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Missing authentication token');
      }

      const payload = await this.jwtService.verifyAsync(token);
      // JWT payload: sub (user id), email?, phone?, role — attach to socket.data (Socket.IO recommended API)
      client.data.userId = payload.sub;
      client.data.userEmail = payload.email;
      client.data.userPhone = payload.phone;
      client.data.userRole = payload.role;

      return true;
    } catch (error) {
      throw new WsException('Invalid authentication token');
    }
  }

  /** Shared extraction order: handshake.auth.token, handshake.query.token, Authorization header */
  /** Shared extraction order: handshake.auth.token, handshake.query.token, Authorization header */
  static extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    const queryToken = (client.handshake.query as any)?.token;
    const headerAuth = client.handshake.headers?.authorization;

    // helper: normaliza a string y recorta "Bearer"
    const normalize = (v: unknown): string | null => {
      if (!v) return null;
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s !== 'string') return null;

      const trimmed = s.trim();
      if (!trimmed) return null;

      // soporta Bearer/bearer + espacios
      return trimmed.replace(/^bearer\s+/i, '');
    };

    return (
      normalize(authToken) ||
      normalize(queryToken) ||
      normalize(headerAuth)
    );
  }

  private extractToken(client: Socket): string | null {
    return WsJwtGuard.extractToken(client);
  }
}