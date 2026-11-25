import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptions,
  type JwtFromRequestFunction,
} from 'passport-jwt';

function parseJwtSub(sub: unknown): number {
  const n = typeof sub === 'string' ? parseInt(sub, 10) : Number(sub);
  if (!Number.isFinite(n) || n < 1) {
    throw new UnauthorizedException('Invalid token subject (sub)');
  }
  return Math.trunc(n);
}

function normalizeJwtRole(
  role: unknown,
): 'USER' | 'STORE_OWNER' | 'ADMIN' | undefined {
  if (role === undefined || role === null || role === '') return undefined;
  const u = String(role).toUpperCase();
  if (u === 'USER' || u === 'STORE_OWNER' || u === 'ADMIN') return u;
  return undefined;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();

    const opts: StrategyOptions = {
      jwtFromRequest,
      secretOrKey: process.env.JWT_SECRET as string,
      ignoreExpiration: false,
    };

    super(opts);
  }

  validate(payload: {
    sub?: number | string;
    email?: string;
    phone?: string;
    role?: string;
  }) {
    const id = parseJwtSub(payload.sub);
    const role = normalizeJwtRole(payload.role) ?? 'USER';
    return {
      id,
      email: payload.email,
      phone: payload.phone,
      role,
    };
  }
}
