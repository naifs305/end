import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import api from '../../lib/axios';
import RoleSwitcher from './RoleSwitcher';

const NOTIFICATION_CACHE_TTL_MS = 30000;

const ROLE_LABELS = { EMPLOYEE: 'موظف', PROJECT_SUPERVISOR: 'مشرف مشروع', MANAGER: 'مدير', QUALITY_VIEWER: 'مراقب جودة' };

export default function Header({ onMenuClick }) {
  const { user, logout, activeRole } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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
    return () => { mounted = false; };
  }, [user, cacheKey]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">

        {/* زر القائمة — جوال فقط */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-text-main hover:bg-background transition md:hidden"
          aria-label="فتح القائمة"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span>القائمة</span>
        </button>

        {/* أدوات اليمين */}
        <div className="flex flex-1 items-center justify-end gap-2">
          {/* الإشعارات */}
          <Link href="/notifications" className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-text-main transition hover:bg-background">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </div>
          </Link>

          {/* محوّل الدور */}
          {user && user.roles?.length > 1 && <RoleSwitcher />}

          {/* قائمة المستخدم */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-background"
              >
                <div className="hidden max-w-[160px] flex-col items-end md:flex">
                  <span className="truncate text-sm font-bold text-text-main">{user.firstName} {user.lastName}</span>
                  <span className="truncate text-[11px] text-text-soft">{user.email}</span>
                </div>
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                  {user.profileImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.profileImage} alt="الصورة الشخصية" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-extrabold text-text-soft">
                      {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                    </div>
                  )}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
                    <div className="border-b border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                          {user.profileImage ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={user.profileImage} alt="الصورة الشخصية" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-text-soft">
                              {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate text-sm font-bold text-text-main">{user.firstName} {user.lastName}</p>
                          <p className="truncate text-[11px] text-text-soft">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(user.roles || []).map((r) => (
                          <span key={r} className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-text-soft">
                            {ROLE_LABELS[r] || r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-2">
                      <Link href="/profile" onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-text-main transition hover:bg-background">
                        الملف الشخصي
                      </Link>
                      <button
                        onClick={logout}
                        className="mt-1 w-full rounded-xl border border-danger/30 px-3 py-2 text-center text-sm font-bold text-danger transition hover:bg-burgundy/5"
                      >
                        تسجيل الخروج
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
