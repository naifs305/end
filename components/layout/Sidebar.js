import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, canAccessKpis, canViewReportsOnly } from '../../lib/roles';

export default function Sidebar() {
  const router = useRouter();
  const { activeRole } = useAuth();

  const isAdmin = isAdminRole(activeRole);
  const isManager = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const canViewKpis = canAccessKpis(activeRole);
  const isQualityViewer = canViewReportsOnly(activeRole);

  const isActive = (href) => router.pathname === href;

  const getLinkClass = (href) =>
    `flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive(href)
        ? 'bg-primary text-white shadow-soft'
        : 'text-text-main hover:bg-primary-light hover:text-primary'
    }`;

  const sectionTitleClass = 'px-4 mt-6 mb-2 text-[11px] font-bold tracking-wide text-text-soft';
  const itemWrapperClass = 'space-y-1';

  return (
    <aside className="hidden w-72 flex-col border-l border-primary-dark/20 bg-white shadow-card md:flex">
      <div className="flex min-h-[82px] items-center justify-center border-b border-border px-5">
        <div className="relative h-10 w-32 max-w-full">
          <Image src="/nauss-logo.png" alt="شعار جامعة نايف" fill className="object-contain" priority />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!isQualityViewer ? (
          <>
            <div className={itemWrapperClass}>
              <div className={sectionTitleClass}>الرئيسية</div>
              <Link href="/" className={getLinkClass('/')}><span className="mx-2">لوحة التحكم</span></Link>
            </div>

            <div className={itemWrapperClass}>
              <div className={sectionTitleClass}>العمليات</div>
              <Link href="/courses" className={getLinkClass('/courses')}><span className="mx-2">إدارة الدورات</span></Link>
              {(isAdmin || isSupervisor) && (
                <>
                  <Link href="/approvals" className={getLinkClass('/approvals')}><span className="mx-2">الاعتمادات</span></Link>
                  <Link href="/archive" className={getLinkClass('/archive')}><span className="mx-2">أرشيف الإقفالات</span></Link>
                </>
              )}
              {activeRole === 'EMPLOYEE' && (
                <Link href="/archive" className={getLinkClass('/archive')}><span className="mx-2">أرشيفي</span></Link>
              )}
            </div>
          </>
        ) : null}

        <div className={itemWrapperClass}>
          <div className={sectionTitleClass}>التقارير والمتابعة</div>
          <Link href="/reports" className={getLinkClass('/reports')}><span className="mx-2">التقارير الميدانية</span></Link>
          {!isQualityViewer && canViewKpis && (
            <Link href="/kpis" className={getLinkClass('/kpis')}><span className="mx-2">مؤشرات الأداء</span></Link>
          )}
          {!isQualityViewer && isAdmin && (
            <Link href="/audit" className={getLinkClass('/audit')}><span className="mx-2">سجل المراجعة</span></Link>
          )}
        </div>

        {!isQualityViewer && (
          <>
            <div className={itemWrapperClass}>
              <div className={sectionTitleClass}>الاتصال</div>
              <Link href="/messages" className={getLinkClass('/messages')}><span className="mx-2">المراسلات</span></Link>
            </div>

            {isAdmin && (
              <div className={itemWrapperClass}>
                <div className={sectionTitleClass}>الإدارة</div>
                <Link href="/users" className={getLinkClass('/users')}><span className="mx-2">المستخدمين</span></Link>
                {isManager && <Link href="/projects" className={getLinkClass('/projects')}><span className="mx-2">المشاريع التشغيلية</span></Link>}
                {isManager && <Link href="/jobs" className={getLinkClass('/jobs')}><span className="mx-2">المهام المجدولة</span></Link>}
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
