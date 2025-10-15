import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptions,
  type JwtFromRequestFunction,
} from 'passport-jwt';

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

  validate(payload: { sub: number; email: string; role?: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
