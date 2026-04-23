import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import api from '../../lib/axios';
import RoleSwitcher from './RoleSwitcher';

const NOTIFICATION_CACHE_TTL_MS = 30000;

export default function Header() {
  const { user, logout, activeRole } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        const res = await api.get('/notifications');
        const unread = (res.data || []).filter((n) => !n.isRead).length;
        sessionStorage.setItem(cacheKey, JSON.stringify({ count: unread, timestamp: Date.now() }));
        if (mounted) setNotifCount(unread);
      } catch (error) {
        console.error('Header notifications error:', error);
      }
    };

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, [user, cacheKey]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeRole]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-text-main"
          >
            القائمة
          </button>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link href="/notifications" className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-text-main transition hover:bg-background">
              <span className="text-lg">🔔</span>
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
                  {notifCount}
                </span>
              )}
            </div>
          </Link>

          {user && user.roles.length > 1 && <RoleSwitcher />}

          {user && (
            <div className="hidden max-w-[240px] flex-col items-end md:flex">
              <span className="truncate text-sm font-semibold text-text-main">{user.firstName} {user.lastName}</span>
              <span className="truncate text-xs text-text-soft">{user.email}</span>
            </div>
          )}

          <button onClick={logout} className="rounded-xl border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-red-50">
            خروج
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-white px-4 py-4 md:hidden">
          {user && (
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="text-sm font-bold text-text-main">{user.firstName} {user.lastName}</div>
              <div className="mt-1 break-all text-xs text-text-soft">{user.email}</div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
