import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import api from '../../lib/axios';
import RoleSwitcher from './RoleSwitcher';

export default function Header() {
  const { user, logout, activeRole } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const unread = (res.data || []).filter((n) => !n.isRead).length;
      setNotifCount(unread);
    } catch (error) {
      console.error('Header notifications error - Header.js:18', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeRole]);

  const quickLinks =
    activeRole === 'MANAGER'
      ? [
          { href: '/approvals', label: 'الاعتمادات' },
          { href: '/reports', label: 'التقارير' },
          { href: '/archive', label: 'الأرشيف' },
          { href: '/messages', label: 'المراسلات' },
        ]
      : [
          { href: '/courses', label: 'الدورات' },
          { href: '/reports', label: 'التقارير الميدانية' },
          { href: '/archive', label: 'أرشيفي' },
          { href: '/messages', label: 'المراسلات' },
        ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 md:min-h-[80px] md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary md:hidden"
            aria-label="فتح القائمة"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-primary md:text-2xl">
              نظام إقفال الدورات التدريبية
            </h2>
            <p className="mt-1 text-[11px] text-text-soft md:text-xs">
              {activeRole === 'MANAGER' ? 'وضع المدير' : 'وضع الموظف'}
            </p>
          </div>

          <nav className="hidden lg:flex items-center gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/notifications">
            <div className="relative cursor-pointer rounded-xl border border-border bg-white p-2 transition hover:border-primary hover:bg-primary-light">
              <svg
                className="h-5 w-5 text-text-main"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>

              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white">
                  {notifCount}
                </span>
              )}
            </div>
          </Link>

          {user && user.roles.length > 1 && <RoleSwitcher />}

          {user && (
            <div className="hidden md:flex max-w-[240px] flex-col items-end">
              <span className="truncate text-sm font-semibold text-text-main">
                {user.firstName} {user.lastName}
              </span>
              <span className="truncate text-xs text-text-soft">{user.email}</span>
            </div>
          )}

          <button
            onClick={logout}
            className="rounded-xl border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-red-50"
          >
            خروج
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-white px-4 py-4 md:hidden">
          <div className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {user && (
            <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3">
              <div className="text-sm font-bold text-text-main">
                {user.firstName} {user.lastName}
              </div>
              <div className="mt-1 break-all text-xs text-text-soft">{user.email}</div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}