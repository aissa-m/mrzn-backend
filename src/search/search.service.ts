import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SearchSuggestionDto } from './dto/search-suggestion.dto';
import type { SearchFeaturedItemDto } from './dto/search-featured-item.dto';
import type {
  SearchResultItemDto,
  SearchResultsResponseDto,
  SearchResultStoreDto,
} from './dto/search-results-response.dto';
import { getGenericSuggestionsForLang } from './constants/generic-suggestions';

const CURSOR_SEP = '_';
const SUGGESTIONS_MAX_LIMIT = 10;

function normalizeForMatch(s: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function relevanceScore(value: string, normalizedTerm: string): number {
  const n = value.trim().toLowerCase();
  if (normalizedTerm.length === 0) return 0;
  if (n.startsWith(normalizedTerm)) return 2;
  if (n.includes(normalizedTerm)) return 1;
  return 0;
}

/** Resultado de getFeatured findMany (con images) */
type FeaturedRow = {
  id: number;
  name: string;
  price: Prisma.Decimal;
  createdAt: Date;
  categoryId: number | null;
  images: { url: string }[];
};

/** Resultado de getResults findMany (con images, category, store) */
type ResultRow = {
  id: number;
  name: string;
  price: Prisma.Decimal;
  createdAt: Date;
  userId: number;
  categoryId: number | null;
  category: { name: string } | null;
  store: { id: number; name: string; logoImageUrl: string | null } | null;
  images: { url: string }[];
};

/** Fila de producto para suggestions (name, category, store) */
type SuggestionProductRow = {
  id: number;
  name: string;
  category: { name: string } | null;
  store: { name: string } | null;
};

function parseCursor(cursor: string): { createdAt: Date; id: number } | null {
  const i = cursor.lastIndexOf(CURSOR_SEP);
  if (i === -1) return null;
  const createdAtStr = cursor.slice(0, i);
  const idStr = cursor.slice(i + 1);
  const createdAt = new Date(createdAtStr);
  const id = parseInt(idStr, 10);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(id)) return null;
  return { createdAt, id };
}

function encodeCursor(createdAt: Date, id: number): string {
  return `${createdAt.toISOString()}${CURSOR_SEP}${id}`;
}

/**
 * Where para búsqueda por nombre/descripción. Si q está vacío devuelve undefined (sin resultados).
 */
function productSearchWhere(
  q: string,
  excludeUserId?: number,
): Prisma.ProductWhereInput | undefined {
  const term = (q ?? '').trim();
  if (term.length === 0) return undefined;
  const and: Prisma.ProductWhereInput[] = [
    {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
    },
  ];
  if (excludeUserId != null) {
    and.push({ userId: { not: excludeUserId } });
  }
  return { AND: and };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sugerencias híbridas: primero productos (nombre, categoría, tienda), luego genéricas por idioma.
   * Coincidencia por prefijo y parcial, normalizada (case-insensitive, espacios colapsados).
   * Si no hay suficientes resultados reales, completa con sugerencias genéricas (en/fr/ar).
   */
  async getSuggestions(
    q: string | undefined,
    limit: number = 8,
    lang: string = 'en',
  ): Promise<SearchSuggestionDto[]> {
    const rawTerm = (q ?? '').trim();
    const normalizedTerm = normalizeForMatch(rawTerm);
    const take = Math.min(Math.max(1, limit), SUGGESTIONS_MAX_LIMIT);

    if (rawTerm.length === 0) return [];

    const seen = new Set<string>();
    const suggestions: SearchSuggestionDto[] = [];

    if (rawTerm.length > 0) {
      const where: Prisma.ProductWhereInput = {
        OR: [
          { name: { contains: rawTerm, mode: 'insensitive' } },
          { category: { name: { contains: rawTerm, mode: 'insensitive' } } },
          { store: { name: { contains: rawTerm, mode: 'insensitive' } } },
        ],
      };

      const rows = await this.prisma.product.findMany({
        where,
        take: take * 3,
        select: {
          id: true,
          name: true,
          category: { select: { name: true } },
          store: { select: { name: true } },
        },
      }) as SuggestionProductRow[];

      const withScore: { dto: SearchSuggestionDto; score: number }[] = [];
      for (const p of rows) {
        if (p.name?.trim()) {
          const score = relevanceScore(p.name, normalizedTerm);
          if (score > 0) {
            const key = p.name.trim().toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              withScore.push({
                dto: {
                  value: p.name.trim(),
                  source: 'product',
                  kind: 'product_name',
                  id: p.id,
                },
                score,
              });
            }
          }
        }
        if (p.category?.name?.trim()) {
          const name = p.category.name.trim();
          const score = relevanceScore(name, normalizedTerm);
          if (score > 0) {
            const key = `category:${name.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              withScore.push({
                dto: {
                  value: name,
                  source: 'product',
                  kind: 'category',
                  id: p.id,
                },
                score,
              });
            }
          }
        }
        if (p.store?.name?.trim()) {
          const name = p.store.name.trim();
          const score = relevanceScore(name, normalizedTerm);
          if (score > 0) {
            const key = `store:${name.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              withScore.push({
                dto: {
                  value: name,
                  source: 'product',
                  kind: 'store',
                  id: p.id,
                },
                score,
              });
            }
          }
        }
      }

      withScore.sort((a, b) => b.score - a.score);
      for (const { dto } of withScore) {
        suggestions.push(dto);
        if (suggestions.length >= take) break;
      }
    }

    if (suggestions.length < take) {
      const generic = getGenericSuggestionsForLang(lang);
      for (const word of generic) {
        if (suggestions.length >= take) break;
        const wordNorm = word.trim().toLowerCase();
        if (seen.has(wordNorm)) continue;
        const matches =
          normalizedTerm.length === 0 ||
          wordNorm.includes(normalizedTerm) ||
          wordNorm.startsWith(normalizedTerm);
        if (matches) {
          seen.add(wordNorm);
          suggestions.push({
            value: word.trim(),
            source: 'generic',
            kind: 'keyword',
          });
        }
      }
    }

    return suggestions.slice(0, take);
  }

  /**
   * Productos destacados para la búsqueda: coincidencia en name/description,
   * orden: primero coincidencia en nombre, luego createdAt desc. Máximo 10.
   */
  async getFeatured(
    q: string | undefined,
    limit: number = 10,
    excludeUserId?: number,
  ): Promise<SearchFeaturedItemDto[]> {
    const term = (q ?? '').trim();
    const take = Math.min(Math.max(1, limit), 10);
    const where = productSearchWhere(term, excludeUserId);
    if (!where) return [];

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(take * 2, 20),
      select: {
        id: true,
        name: true,
        price: true,
        createdAt: true,
        categoryId: true,
        images: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
    }) as FeaturedRow[];

    const nameLower = term.toLowerCase();
    const sorted = [...rows].sort((a, b) => {
      const aName = a.name.toLowerCase().includes(nameLower) ? 1 : 0;
      const bName = b.name.toLowerCase().includes(nameLower) ? 1 : 0;
      if (bName !== aName) return bName - aName;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return sorted.slice(0, take).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      coverImage: p.images[0]?.url ?? null,
      createdAt: p.createdAt.toISOString(),
      categoryId: p.categoryId ?? null,
    }));
  }

  /**
   * Resultados completos con cursor pagination (infinite scroll).
   * Orden: createdAt desc, id desc. Excluye productos propios si el usuario está autenticado.
   */
  async getResults(
    q: string | undefined,
    limit: number = 20,
    cursor: string | undefined,
    excludeUserId?: number,
  ): Promise<SearchResultsResponseDto> {
    const term = (q ?? '').trim();
    const pageSize = Math.min(Math.max(1, limit), 50);
    const take = pageSize + 1;
    const where = productSearchWhere(term, excludeUserId);
    if (!where) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const parsed = cursor ? parseCursor(cursor) : null;
    const andConditions: Prisma.ProductWhereInput[] = [where];
    if (parsed) {
      andConditions.push({
        OR: [
          { createdAt: { lt: parsed.createdAt } },
          { createdAt: parsed.createdAt, id: { lt: parsed.id } },
        ],
      });
    }
    const fullWhere: Prisma.ProductWhereInput =
      andConditions.length > 1 ? { AND: andConditions } : where;

    const rows = await this.prisma.product.findMany({
      where: fullWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        name: true,
        price: true,
        createdAt: true,
        userId: true,
        categoryId: true,
        category: { select: { name: true } },
        store: {
          select: {
            id: true,
            name: true,
            logoImageUrl: true,
          },
        },
        images: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
    }) as ResultRow[];

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    const resultItems: SearchResultItemDto[] = items.map((p) => {
      const item: SearchResultItemDto = {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        coverImage: p.images[0]?.url ?? null,
        createdAt: p.createdAt.toISOString(),
        categoryId: p.categoryId ?? null,
        categoryName: p.category?.name ?? null,
        userId: p.userId,
      };
      if (p.store) {
        const storeDto: SearchResultStoreDto = {
          storeId: p.store.id,
          name: p.store.name,
          logoImageUrl: p.store.logoImageUrl ?? null,
        };
        item.store = storeDto;
      }
      return item;
    });

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return {
      items: resultItems,
      nextCursor,
      hasMore,
    };
  }
}
