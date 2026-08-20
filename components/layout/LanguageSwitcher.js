import { Languages } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

/**
 * زر بسيط لتبديل اللغة بين العربية والإنجليزية.
 * variant="pill" للاستخدام داخل الأشرطة، variant="ghost" للشاشات العامة.
 */
export default function LanguageSwitcher({ variant = 'pill', className = '' }) {
  const { locale, toggleLocale } = useTranslation();
  const nextLabel = locale === 'ar' ? 'EN' : 'ع';

  const base =
    'inline-flex items-center gap-1.5 font-bold transition focus:outline-none focus:ring-4 focus:ring-primary/10';
  const styles =
    variant === 'ghost'
      ? 'rounded-xl px-3 py-2 text-sm text-text-soft hover:bg-primary-light hover:text-primary'
      : 'rounded-full border border-border bg-white px-3 py-1.5 text-xs text-text-soft shadow-sm hover:bg-primary-light hover:text-primary';

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={locale === 'ar' ? 'English' : 'العربية'}
      className={`${base} ${styles} ${className}`}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{nextLabel}</span>
    </button>
  );
}
