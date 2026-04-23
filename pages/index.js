import { canCreateCourse, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import KPICard from '../components/shared/KPICard';
import Link from 'next/link';

function formatNumber(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0';
  return num.toFixed(2);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ar-SA');
}

function formatPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}

function getDashboardTitle(activeRole, isAdmin) {
  if (activeRole === 'PROJECT_SUPERVISOR') return 'لوحة المشرف';
  if (activeRole === 'QUALITY_VIEWER') return 'لوحة الجودة';
  return isAdmin ? 'لوحة المدير' : 'لوحة الموظف';
}

export default function Home() {
  const router = useRouter();
  const { user, activeRole, loading } = useAuth();
  const isAdmin = isAdminRole(activeRole);
  const [dashboard, setDashboard] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !activeRole) return;
    setPageLoading(true);
    const endpoint = isAdmin ? '/analytics/manager' : '/analytics/employee';
    api
      .get(endpoint)
      .then((res) => setDashboard(res.data || null))
      .catch(() => setDashboard({ totalCourses: 0, openCourses: 0, closedCourses: 0, pendingApprovalCourses: 0, latestCourses: [], kpi: null }))
      .finally(() => setPageLoading(false));
  }, [user, activeRole, isAdmin]);

  const quickCards = useMemo(() => {
    if (!dashboard) return [];
    if (isAdmin) {
      return [
        { title: 'إجمالي الدورات', value: dashboard.totalCourses || 0, href: '/courses', color: 'primary' },
        { title: 'بانتظار الإغلاق', value: dashboard.awaitingClosureCourses || 0, href: '/courses?status=AWAITING_CLOSURE', color: 'yellow' },
        { title: 'العناصر بانتظار الاعتماد', value: dashboard.pendingApprovals || 0, href: '/approvals', color: 'red' },
        { title: 'المستخدمون المسجلون', value: dashboard.totalUsers || 0, href: '/users', color: 'primary' },
      ];
    }
    return [
      { title: 'إجمالي دوراتي', value: dashboard.totalCourses || 0, href: '/courses', color: 'primary' },
      { title: 'الدورات غير المنتهية', value: dashboard.openCourses || 0, href: '/courses', color: 'yellow' },
      { title: 'الدورات المنتهية', value: dashboard.closedCourses || 0, href: '/archive', color: 'primary' },
      { title: 'بانتظار الاعتماد', value: dashboard.pendingApprovalCourses || 0, href: '/courses', color: 'red' },
    ];
  }, [dashboard, isAdmin]);

  if (loading || pageLoading) return <div className="p-10 font-cairo text-text-main">جاري التحميل...</div>;
  if (!user || !dashboard) return null;

  return (
    <MainLayout>
      <div className="min-h-full bg-background p-4 md:p-6">
        <div className="mb-6 rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-text-main md:text-2xl">مرحبًا، {user.firstName}</h1>
                  <p className="mt-2 text-sm text-text-soft">لوحة متابعة سريعة مختصرة حسب الدور النشط</p>
                </div>
                <div className="inline-flex w-fit items-center rounded-2xl border border-primary/20 bg-primary-light px-4 py-2 text-sm font-bold text-primary">
                  {getDashboardTitle(activeRole, isAdmin)}
                </div>
              </div>

              {!isAdmin && canCreateCourse(activeRole) && (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/courses/create"
                    className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-primary-dark"
                  >
                    إضافة دورة جديدة
                  </Link>
                  <Link
                    href="/courses"
                    className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary-light"
                  >
                    إدارة الدورات
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickCards.map((card) => (
            <Link key={card.title} href={card.href}><div className="cursor-pointer"><KPICard title={card.title} value={card.value} color={card.color} /></div></Link>
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <InfoPanel title="ملخص المستخدمين">
              <InfoRow label="الموظفون" value={dashboard.employeesCount || 0} />
              <InfoRow label="مشرفو المشاريع" value={dashboard.supervisorsCount || 0} />
              <InfoRow label="المديرون" value={dashboard.managersCount || 0} />
              <InfoRow label="مستخدمو الجودة" value={dashboard.qualityViewersCount || 0} />
            </InfoPanel>

            <InfoPanel title="ملخص الأداء الشهري">
              <InfoRow label="عدد من لديهم لقطة KPI" value={dashboard.kpiUsersCount || 0} />
              <InfoRow label="الأعلى أداءً" value={dashboard.topPerformer ? `${dashboard.topPerformer.user?.firstName || ''} ${dashboard.topPerformer.user?.lastName || ''}`.trim() || '-' : '-'} compact />
              <InfoRow label="الأقل أداءً" value={dashboard.lowPerformer ? `${dashboard.lowPerformer.user?.firstName || ''} ${dashboard.lowPerformer.user?.lastName || ''}`.trim() || '-' : '-'} compact />
              <InfoRow label="متوسط الدرجة" value={formatNumber(dashboard.averageScore)} />
            </InfoPanel>

            <InfoPanel title="تنبيهات التشغيل">
              <InfoRow label="الدورات المنتهية غير المغلقة" value={dashboard.endedNotClosedCourses || 0} />
              <InfoRow label="بانتظار الإغلاق" value={dashboard.awaitingClosureCourses || 0} />
              <InfoRow label="العناصر المعلقة" value={dashboard.pendingApprovals || 0} />
              <InfoRow label="الدورات قيد التنفيذ" value={dashboard.executionCourses || 0} />
            </InfoPanel>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MetricCard title="نسبة سرعة الإنجاز" value={formatPercent(dashboard.kpi?.speedScore)} subtitle="تعكس سرعة تنفيذك وإقفال العناصر خلال الفترة الحالية" />
            <MetricCard title="نسبة الانضباط" value={formatPercent(dashboard.kpi?.disciplineScore)} subtitle="تعكس انتظامك وتقليل التأخر والعناصر المعلقة" />
            <MetricCard title="أداء الموظف" value={formatPercent(dashboard.kpi?.finalScore)} subtitle="المحصلة العامة لأدائك بحسب مؤشرات المنصة" />
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-primary">آخر الدورات</h3>
            <Link href="/courses" className="text-sm font-bold text-primary hover:text-primary-dark">فتح إدارة الدورات</Link>
          </div>

          {!dashboard.latestCourses || dashboard.latestCourses.length === 0 ? (
            <div className="text-sm text-text-soft">لا توجد بيانات حديثة لعرضها.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboard.latestCourses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`}>
                  <div className="cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 transition hover:border-primary/30 hover:bg-primary-light/30">
                    <div className="mb-1 line-clamp-2 text-sm font-extrabold text-text-main">{course.name || '-'}</div>
                    <div className="mb-1 text-xs text-text-soft">{formatDate(course.startDate)} — {formatDate(course.endDate)}</div>
                    <div className="text-xs font-bold text-primary">{translateCourseStatus(course.status)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function InfoPanel({ title, children }) {
  return <div className="rounded-2xl border border-border bg-white p-5 shadow-card"><div className="mb-4 text-lg font-extrabold text-primary">{title}</div><div className="space-y-3">{children}</div></div>;
}

function InfoRow({ label, value, compact = false }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
      <span className="text-sm text-text-soft">{label}</span>
      <span className={`font-extrabold text-text-main ${compact ? 'max-w-[12rem] text-sm text-left leading-6' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

function MetricCard({ title, value, subtitle }) {
  return <div className="rounded-2xl border border-border bg-white p-5 shadow-card"><div className="mb-2 text-sm font-bold text-text-soft">{title}</div><div className="mb-2 text-3xl font-extrabold text-primary">{value}</div><div className="text-sm leading-7 text-text-soft">{subtitle}</div></div>;
}

function translateCourseStatus(status) {
  switch (status) {
    case 'PREPARATION': return 'قيد الإعداد';
    case 'EXECUTION': return 'قيد التنفيذ';
    case 'AWAITING_CLOSURE': return 'بانتظار الإغلاق';
    case 'CLOSED': return 'مغلقة';
    case 'ARCHIVED': return 'مؤرشفة';
    default: return status || '-';
  }
}
