/**
 * Sugerencias genéricas por idioma para el autocomplete cuando hay pocos productos.
 * Sustituible por datos reales (ej. trending, categorías populares) más adelante.
 */
export const GENERIC_SUGGESTIONS_BY_LANG: Record<string, string[]> = {
  en: [
    'car',
    'cars',
    'motorbike',
    'motorcycle',
    'tv',
    'phone',
    'electronics',
    'home',
    'furniture',
  ],
  fr: [
    'voiture',
    'voitures',
    'moto',
    'télévision',
    'tv',
    'téléphone',
    'électronique',
    'maison',
    'meuble',
  ],
  ar: [
    'سيارة',
    'سيارات',
    'دراجة',
    'دراجة نارية',
    'تلفاز',
    'هاتف',
    'إلكترونيات',
    'منزل',
    'أثاث',
  ],
};

export const SUPPORTED_SUGGESTION_LANGS = ['en', 'fr', 'ar'] as const;
export type SuggestionLang = (typeof SUPPORTED_SUGGESTION_LANGS)[number];

export function getGenericSuggestionsForLang(lang: string): string[] {
  const normalized = lang?.toLowerCase().trim() || 'en';
  return GENERIC_SUGGESTIONS_BY_LANG[normalized] ?? GENERIC_SUGGESTIONS_BY_LANG['en'];
}
