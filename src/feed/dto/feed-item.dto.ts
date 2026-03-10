/**
 * Información básica de tienda incluida en un ítem del feed
 * cuando el producto está asociado a una tienda.
 */
export class FeedStoreDto {
  storeId: number;
  name: string;
  logoImageUrl: string | null;
}

/**
 * Un producto en el feed reciente: datos necesarios para el frontend.
 */
export class FeedItemDto {
  id: number;
  name: string;
  price: number;
  /** Primera imagen del producto (portada) o null si no tiene imágenes */
  coverImage: string | null;
  createdAt: string;
  userId: number;
  /** ID de categoría del producto; null si no está asignada (permite filtrar por categoría en el frontend) */
  categoryId: number | null;
  /** Nombre de la categoría; null si no hay categoría */
  categoryName?: string | null;
  /** Estado del producto en el feed (ACTIVE | RESERVED | SOLD | PAUSED) */
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED';
  /** Presente solo si el producto tiene storeId */
  store?: FeedStoreDto;
}
