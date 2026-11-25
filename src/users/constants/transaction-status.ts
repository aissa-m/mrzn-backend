import { OrderStatus } from '@prisma/client';

/**
 * Estado de transacción expuesto a la API (móvil).
 * El frontend no necesita conocer los estados internos de Order (Prisma).
 */
export type TransactionStatusFilter = 'in_progress' | 'completed' | 'all';

/**
 * Mapeo backend: qué OrderStatus se consideran "en curso" vs "finalizados".
 * - in_progress: PENDING, PAID, SHIPPED (pedido activo, no cerrado ni cancelado).
 * - completed: COMPLETED, CANCELED.
 */
export const ORDER_STATUS_TO_TRANSACTION: Record<OrderStatus, 'in_progress' | 'completed'> = {
  [OrderStatus.PENDING]: 'in_progress',
  [OrderStatus.PAID]: 'in_progress',
  [OrderStatus.SHIPPED]: 'in_progress',
  [OrderStatus.COMPLETED]: 'completed',
  [OrderStatus.CANCELED]: 'completed',
};

export const IN_PROGRESS_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
];

export const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELED,
];
