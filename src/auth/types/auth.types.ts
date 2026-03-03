// src/auth/types/auth.types.ts
export interface JwtUserPayload {
  id: number;
  email?: string;
  phone?: string;
  role?: 'ADMIN' | 'STORE_OWNER' | 'USER';
}
