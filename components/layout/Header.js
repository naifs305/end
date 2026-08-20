import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import { Menu, Bell, User, LogOut, LayoutDashboard, PanelLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/axios';
import RoleSwitcher from './RoleSwitcher';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../../lib/i18n';
import { buildNavSections } from './navConfig';

const NOTIFICATION_CACHE_TTL_MS = 30000;

// نمط موحّد لأزرار الأيقونات في الترويسة
const ICON_BTN =
  'flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-text-soft transition-all duration-200 hover:border-primary/40 hover:bg-primary-light hover:text-primary active:scale-95';

export default function Header({ onMenuClick, scrolled = false, onToggleSidebar, breadcrumb }) {
  const { user, logout, activeRole } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // عنوان الصفحة الحالي (الأيقونة + الاسم) من إعدادات التنقّل
  const currentItem = useMemo(() => {
    const items = buildNavSections(activeRole, t).flatMap((s) => s.items);
    return (
      items.find((it) => (it.href === '/' ? router.pathname === '/' : router.pathname.startsWith(it.href))) || null
    );
  }, [activeRole, router.pathname, t]);
  const PageIcon = currentItem?.icon || LayoutDashboard;
  const pageTitle = currentItem?.label || t('common.appNameShort');

  const cacheKey = useMemo(() => {
    if (!user?.id) return null;
    return `notif-count-${user.id}`;
  }, [user]);

  useEffect(() => {
    if (!user || !cacheKey) return;
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const cachedRaw = sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached.timestamp && Date.now() - cached.timestamp < NOTIFICATION_CACHE_TTL_MS) {
              if (mounted) setNotifCount(Number(cached.count || 0));
              return;
            }
          } catch {
            sessionStorage.removeItem(cacheKey);
          }
        }
        const res = await api.get('/notifications', { params: { unread: 'true', limit: 1 } });
        const d = res.data;
        const unread = d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0);
        sessionStorage.setItem(cacheKey, JSON.stringify({ count: unread, timestamp: Date.now() }));
        if (mounted) setNotifCount(unread);
      } catch {}
    };

    loadNotifications();
    return () => {
      mounted = false;
    };
  }, [user, cacheKey]);

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/60 backdrop-blur-xl transition-all duration-300 ${
        scrolled ? 'border-white/60 shadow-card' : 'border-white/40'
      }`}
    >
      <div className={`flex items-center justify-between gap-3 px-4 transition-all duration-300 md:px-6 ${scrolled ? 'py-1.5' : 'py-2.5'}`}>
        {/* جهة البداية: زر القائمة + طيّ الشريط + عنوان الصفحة / مسار التنقّل */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-main transition-all hover:border-primary/40 hover:bg-primary-light hover:text-primary active:scale-95 md:hidden"
            aria-label={t('common.openMenu')}
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          {/* طيّ/فتح الشريط الجانبي — سطح المكتب */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border text-text-soft transition-all hover:border-primary/40 hover:bg-primary-light hover:text-primary active:scale-95 md:flex"
              aria-label={t('common.menu')}
            >
              <PanelLeft size={18} aria-hidden="true" />
            </button>
          )}

          {breadcrumb?.length ? (
            <nav className="flex min-w-0 items-center gap-1.5" aria-label="breadcrumb">
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary sm:flex">
                <PageIcon size={18} aria-hidden="true" />
              </span>
              {breadcrumb.map((c, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={i} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-text-soft/40" />}
                    {c.href && !isLast ? (
                      <Link href={c.href} className="truncate text-sm font-bold text-text-soft transition hover:text-primary">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-extrabold text-text-main md:text-base">{c.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary sm:flex">
                <PageIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold leading-tight text-text-main">{pageTitle}</h1>
                {!scrolled && <p className="hidden truncate text-[11px] text-text-soft sm:block">{t('common.appNameShort')}</p>}
              </div>
            </div>
          )}
        </div>

        {/* أدوات الطرف */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="pill" />

          {/* الإشعارات */}
          <Link href="/notifications" className={`relative ${ICON_BTN}`} aria-label={t('nav.notifications')}>
            <Bell size={18} aria-hidden="true" />
            {notifCount > 0 && (
              <span className="absolute -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white -end-1.5">
                {notifCount > 99 ? '99+' : notifCount}
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" aria-hidden="true" />
              </span>
            )}
          </Link>

          {/* محوّل الدور */}
          {user && user.roles?.length > 1 && <RoleSwitcher />}

          {/* قائمة المستخدم */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-primary-light"
                aria-label={t('nav.profile')}
              >
                <div className="hidden max-w-[160px] flex-col items-end md:flex">
                  <span className="truncate text-sm font-bold text-text-main">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="truncate text-[11px] text-text-soft">{user.email}</span>
                </div>
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15">
                  {user.profileImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.profileImage} alt={t('common.profileImage')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-extrabold text-primary">{initials}</div>
                  )}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="animate-pop-in absolute top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-white shadow-deep end-0">
                    <div className="border-b border-border bg-gradient-to-b from-primary-light/50 to-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15">
                          {user.profileImage ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={user.profileImage} alt={t('common.profileImage')} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-primary">{initials}</div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate text-sm font-bold text-text-main">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-[11px] text-text-soft">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(user.roles || []).map((r) => (
                          <span key={r} className="rounded-full border border-primary/15 bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">
                            {t(`roles.${r}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-2">
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-text-main transition hover:bg-primary-light hover:text-primary"
                      >
                        <User size={16} aria-hidden="true" />
                        {t('nav.profile')}
                      </Link>
                      <button
                        onClick={logout}
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-3 py-2 text-center text-sm font-bold text-danger transition hover:bg-danger hover:text-white active:scale-[.98]"
                      >
                        <LogOut size={16} aria-hidden="true" />
                        {t('common.logout')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
