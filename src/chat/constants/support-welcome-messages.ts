export const SUPPORT_WELCOME_MESSAGES_BY_LANG: Record<string, string> = {
  en: 'Welcome to MRZN Support. Please describe your issue and our team will assist you as soon as possible. For faster help, include details about the product, order, or transaction involved.',
  fr: 'Bienvenue sur l’assistance MRZN. Merci de décrire votre problème et notre équipe vous aidera dès que possible. Pour une prise en charge plus rapide, indiquez les détails du produit, de la commande ou de la transaction concernée.',
  ar: 'مرحبًا بك في دعم MRZN. يرجى وصف مشكلتك وسيساعدك فريقنا في أقرب وقت ممكن. للحصول على مساعدة أسرع، يرجى ذكر تفاصيل المنتج أو الطلب أو العملية المعنية.',
};

export const SUPPORTED_SUPPORT_LANGS = ['en', 'fr', 'ar'] as const;
export type SupportLang = (typeof SUPPORTED_SUPPORT_LANGS)[number];

export function getSupportWelcomeMessageForLang(lang?: string): string {
  const normalized = lang?.toLowerCase().trim();

  if (!normalized) {
    // Fallback por defecto: francés
    return SUPPORT_WELCOME_MESSAGES_BY_LANG['fr'];
  }

  return (
    SUPPORT_WELCOME_MESSAGES_BY_LANG[normalized] ??
    SUPPORT_WELCOME_MESSAGES_BY_LANG['fr']
  );
}

export function isSupportWelcomeMessage(content?: string | null): boolean {
  if (!content) return false;
  return Object.values(SUPPORT_WELCOME_MESSAGES_BY_LANG).includes(content);
}