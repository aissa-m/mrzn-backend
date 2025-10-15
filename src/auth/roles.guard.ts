import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

// Define un tipo explícito para el usuario dentro de req.user
export interface JwtUserPayload {
  id: number;
  email: string;
  role?: 'ADMIN' | 'STORE_OWNER' | 'USER';
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      Array<'ADMIN' | 'STORE_OWNER' | 'USER'>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Si la ruta no requiere roles específicos, se permite el acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;

    // Retorna true solo si el usuario tiene rol y está incluido en los requeridos
    return Boolean(user?.role && requiredRoles.includes(user.role));
  }
}
