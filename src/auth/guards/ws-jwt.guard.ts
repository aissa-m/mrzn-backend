// src/auth/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId: number;
  userEmail: string;
  userRole: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: AuthenticatedSocket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Missing authentication token');
      }

      const payload = await this.jwtService.verifyAsync(token);
      
      // Adjuntar al socket para uso posterior
      client.userId = payload.id;
      client.userEmail = payload.email;
      client.userRole = payload.role;

      return true;
    } catch (error) {
      throw new WsException('Invalid authentication token');
    }
  }

  private extractToken(client: Socket): string | null {
    // Soportar tanto query param como header
    const tokenFromQuery = client.handshake.auth?.token || client.handshake.query?.token;
    const tokenFromHeader = client.handshake.headers?.authorization;

    if (tokenFromQuery) {
      return Array.isArray(tokenFromQuery) ? tokenFromQuery[0] : tokenFromQuery;
    }

    if (tokenFromHeader && typeof tokenFromHeader === 'string') {
      return tokenFromHeader.replace('Bearer ', '');
    }

    return null;
  }
}