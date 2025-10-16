// src/auth/types.ts
export interface JwtUserPayload {
  id: number;
  email: string;
  role?: 'ADMIN' | 'STORE_OWNER' | 'USER';
}
