import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import {
  isAdminRole,
  canEvaluatePerformance,
  canManageProjects,
  translateRole,
} from '../../lib/roles';

export default function Sidebar() {
  const router = useRouter();
  const { activeRole, user } = useAuth();

  const isAdmin = isAdminRole(activeRole);
  const isManager = activeRole === 'MANAGER';

  const itemClass = (href) => `flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
    router.pathname === href
      ? 'bg-primary text-white shadow-soft'
      : 'text-text-main hover:bg-primary-light hover:text-primary'
  }`;

  const sectionTitle = 'mb-2 mt-6 px-4 text-[11px] font-bold tracking-wide text-text-soft';

  return (
    <aside className="hidden w-72 border-l border-primary-dark/20 bg-white shadow-card md:flex md:flex-col">
      <div className="border-b border-border px-5 py-5">
        <div className="relative mx-auto h-10 w-32">
          <Image src="/nauss-logo.png" alt="شعار الجامعة" fill className="object-contain" priority />
        </div>
        <div className="mt-4 rounded-xl bg-background px-3 py-2 text-center text-xs text-text-soft">
          الدور النشط: <span className="font-bold text-text-main">{translateRole(activeRole)}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className={sectionTitle}>الرئيسية</div>
        <Link href="/" className={itemClass('/')}>لوحة التحكم</Link>

        <div className={sectionTitle}>العمليات</div>
        <Link href="/courses" className={itemClass('/courses')}>الدورات</Link>
        <Link href="/archive" className={itemClass('/archive')}>
          {activeRole === 'EMPLOYEE' ? 'أرشيفي' : 'أرشيف الإقفالات'}
        </Link>
        {isAdmin && <Link href="/approvals" className={itemClass('/approvals')}>الاعتمادات</Link>}

        <div className={sectionTitle}>المتابعة</div>
        <Link href="/reports" className={itemClass('/reports')}>التقارير</Link>
        <Link href="/messages" className={itemClass('/messages')}>المراسلات</Link>
        <Link href="/notifications" className={itemClass('/notifications')}>الإشعارات</Link>
        {canEvaluatePerformance(activeRole) && <Link href="/kpis" className={itemClass('/kpis')}>مؤشرات الأداء</Link>}
        {isAdmin && <Link href="/audit" className={itemClass('/audit')}>سجل التدقيق</Link>}

        {isAdmin && (
          <>
            <div className={sectionTitle}>الإدارة</div>
            <Link href="/users" className={itemClass('/users')}>المستخدمون</Link>
            {canManageProjects(activeRole) && <Link href="/projects" className={itemClass('/projects')}>المشاريع التشغيلية</Link>}
            {isManager && <Link href="/jobs" className={itemClass('/jobs')}>المهام المجدولة</Link>}
          </>
        )}
      </nav>
    </aside>
  );
}
