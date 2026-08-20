// درج تنقل الجوال — يظهر فوق الشاشة كـ slide-over
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../lib/i18n';
import { buildNavSections } from './navConfig';
import NavLink from './NavLink';

export default function MobileNav({ open, onClose }) {
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const { t } = useTranslation();

  const sections = buildNavSections(activeRole, t);

  // إغلاق الدرج عند التنقل
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  // إغلاق بـ Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // تجميد التمرير عند فتح الدرج
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const active = (href) => router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  if (!open) return null;

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');

  return (
    <>
      {/* طبقة تعتيم */}
      <div className="animate-fade-in fixed inset-0 z-50 bg-primary-dark/40 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden />

      {/* الدرج */}
      <div
        className="animate-slide-up fixed inset-y-0 z-50 flex w-72 flex-col border-s border-white/40 bg-white/80 shadow-deep backdrop-blur-xl md:hidden end-0"
        role="dialog"
        aria-modal="true"
      >
        {/* رأس الدرج */}
        <div className="flex h-[76px] items-center justify-between border-b border-white/40 bg-white/40 px-4">
          <div className="relative h-11 w-40">
            <Image
              src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
              alt={t('common.university')}
              fill
              className="object-contain"
              priority
            />
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-soft transition hover:border-primary/40 hover:bg-primary-light hover:text-primary active:scale-95"
            aria-label={t('common.close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* معلومات المستخدم */}
        {user && (
          <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-main">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-text-soft">{user.email}</p>
            </div>
          </div>
        )}

        {/* روابط التنقل */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {sections.map((sec) => (
            <div key={sec.title}>
              <p className="flex items-center gap-2 px-2 pt-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-text-soft/70">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                {sec.title}
              </p>
              {sec.items.map(({ href, icon, label }) => (
                <NavLink key={href} href={href} icon={icon} label={label} active={active(href)} onClick={onClose} />
              ))}
            </div>
          ))}
        </nav>

        {/* حقوق النشر */}
        <div className="border-t border-border bg-background px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-text-soft/70">{t('common.footerOrg')}</p>
          <p className="text-[10px] text-text-soft/40">{t('common.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </>
  );
}
