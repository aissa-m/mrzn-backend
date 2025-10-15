import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Reutilizamos el tipo del usuario del token
export interface JwtUserPayload {
  id: number;
  email: string;
  role?: 'ADMIN' | 'STORE_OWNER' | 'USER';
}

/**
 * Decorador para extraer el usuario autenticado del request.
 * Ejemplo de uso:
 *    @Get('me')
 *    me(@CurrentUser() user: JwtUserPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    return request.user;
  },
);
