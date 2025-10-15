import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'ADMIN' | 'STORE_OWNER' | 'USER'>) =>
  SetMetadata(ROLES_KEY, roles);
