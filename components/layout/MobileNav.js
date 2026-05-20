// درج تنقل الجوال — يظهر فوق الشاشة كـ slide-over من اليسار
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, canAccessKpis, canViewReportsOnly } from '../../lib/roles';

function Icon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home:     'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  courses:  'M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  check:    'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  archive:  'M21 8l-1-1H4L3 8v2h18V8z M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9 M9 14h6',
  chart:    'M18 20V10 M12 20V4 M6 20v-6',
  kpi:      'M22 12h-4l-3 9L9 3l-3 9H2',
  search:   'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  message:  'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 7a4 4 0 100 8 4 4 0 000-8z',
  project:  'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  bell:     'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  report:   'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
};

export default function MobileNav({ open, onClose }) {
  const router = useRouter();
  const { user, activeRole } = useAuth();

  const isAdmin      = isAdminRole(activeRole);
  const isManager    = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const canViewKpis  = canAccessKpis(activeRole);
  const isQuality    = canViewReportsOnly(activeRole);

  // إغلاق الدرج عند التنقل
  useEffect(() => {
    if (open) onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  // إغلاق بـ Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // تجميد scroll عند فتح الدرج
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const active = (href) =>
    router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  const link = (href, icon, label) => (
    <Link key={href} href={href} onClick={onClose}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
        ${active(href)
          ? 'bg-primary text-white shadow-soft'
          : 'text-text-main hover:bg-primary-light hover:text-primary'}`}>
      <Icon d={ICONS[icon]} size={16} />
      <span>{label}</span>
    </Link>
  );

  const section = (title) => (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-text-soft/70">
      {title}
    </p>
  );

  if (!open) return null;

  return (
    <>
      {/* طبقة تعتيم */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden
      />

      {/* الدرج */}
      <div className="fixed inset-y-0 right-0 z-50 w-72 flex flex-col bg-white shadow-2xl md:hidden"
        style={{ borderInlineStart: '1px solid #D8DDDA' }}>

        {/* رأس الدرج */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="relative h-10 w-36">
            <Image src="/nauss-logo.png" alt="جامعة نايف" fill className="object-contain object-right" priority />
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-soft hover:bg-background"
            aria-label="إغلاق"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* معلومات المستخدم */}
        {user && (
          <div className="border-b border-border px-4 py-3 bg-background">
            <p className="text-sm font-bold text-text-main">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-text-soft mt-0.5 truncate">{user.email}</p>
          </div>
        )}

        {/* روابط التنقل */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">

          {!isQuality && (
            <>
              {section('الرئيسية')}
              {link('/', 'home', 'لوحة التحكم')}

              {section('العمليات')}
              {link('/courses', 'courses', 'إدارة الدورات')}
              {(isAdmin || isSupervisor) && link('/approvals', 'check', 'الاعتمادات')}
              {(isAdmin || isSupervisor) && link('/archive', 'archive', 'أرشيف الإقفالات')}
              {activeRole === 'EMPLOYEE' && link('/archive', 'archive', 'أرشيفي')}
            </>
          )}

          {section('التقارير والمتابعة')}
          {link('/reports', 'chart', 'التقارير الميدانية')}
          {!isQuality && canViewKpis && link('/kpis', 'kpi', 'مؤشرات الأداء')}
          {isQuality && link('/quality', 'kpi', 'لوحة الجودة')}
          {!isQuality && (isAdmin || isSupervisor) && link('/executive-report', 'report', 'التقرير القيادي')}
          {!isQuality && isAdmin && link('/audit', 'search', 'سجل المراجعة')}

          {!isQuality && (
            <>
              {section('الاتصال')}
              {link('/messages', 'message', 'المراسلات')}
              {link('/notifications', 'bell', 'الإشعارات')}
            </>
          )}

          {!isQuality && isAdmin && (
            <>
              {section('الإدارة')}
              {link('/users', 'users', 'المستخدمين')}
              {isManager && link('/projects', 'project', 'المشاريع التشغيلية')}
              {isManager && link('/jobs', 'settings', 'المهام المجدولة')}
            </>
          )}
        </nav>

        {/* حقوق النشر */}
        <div className="border-t border-border bg-background px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-text-soft/60">إدارة عمليات التدريب</p>
          <p className="text-[10px] text-text-soft/40">© {new Date().getFullYear()} جميع الحقوق محفوظة</p>
        </div>
      </div>
    </>
  );
}
