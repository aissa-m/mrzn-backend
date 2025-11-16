// src/common/types/express.d.ts

import { Request } from 'express';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN' | 'STORE_OWNER';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
