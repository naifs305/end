import dynamic from 'next/dynamic';
import { canCreateCourse, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import Link from 'next/link';

// الرسوم البيانية — dynamic لتجنب SSR
const StatusDonut  = dynamic(() => import('../components/charts/StatusDonut'),  { ssr: false });
const TeamBarChart = dynamic(() => import('../components/charts/TeamBarChart'), { ssr: false });

// ======================================================================
// أدوات
// ======================================================================

function fmt(v, d = 1) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_MAP = {
  DRAFT:            { label: 'مسودة',            cls: 'bg-border/60 text-text-soft' },
  PREPARATION:      { label: 'قيد الإعداد',      cls: 'bg-background text-text-soft border-border' },
  IN_PROGRESS:      { label: 'قيد التنفيذ',      cls: 'bg-primary-light text-primary' },
  EXECUTION:        { label: 'قيد التنفيذ',      cls: 'bg-primary-light text-primary' },
  AWAITING_CLOSURE: { label: 'بانتظار الإغلاق',  cls: 'bg-sand/20 text-warning border-sand/40' },
  CLOSED:           { label: 'مغلقة',             cls: 'bg-forest-50 text-accent border-accent/20' },
  ARCHIVED:         { label: 'مؤرشفة',            cls: 'bg-border text-text-soft' },
};

// ======================================================================
// مكونات صغيرة
// ======================================================================

function StatCard({ icon, label, value, sub, color = 'primary', href }) {
  const colors = {
    primary: { bg: 'bg-primary-light', text: 'text-primary',  border: 'border-primary/20', val: 'text-primary' },
    amber:   { bg: 'bg-sand/20',       text: 'text-warning',  border: 'border-sand/40',    val: 'text-warning' },
    red:     { bg: 'bg-burgundy/10',   text: 'text-danger',   border: 'border-burgundy/20',val: 'text-danger' },
    green:   { bg: 'bg-forest-50',     text: 'text-accent',   border: 'border-accent/20',  val: 'text-accent' },
  };
  const c = colors[color] || colors.primary;
  const inner = (
    <div className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${c.border}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-soft">{label}</p>
        <p className={`text-2xl font-extrabold ${c.val}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-text-soft">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ChartCard({ title, sub, children, action }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <div className="flex items-start justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-extrabold text-text-main">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-text-soft">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function AlertItem({ icon, text, tone = 'amber' }) {
  const cls = {
    amber: 'border-sand/40 bg-sand/10 text-warning',
    red:   'border-burgundy/20 bg-burgundy/5 text-danger',
    green: 'border-accent/20 bg-forest-50 text-accent',
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${cls[tone] || cls.amber}`}>
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function CourseCard({ course }) {
  const s = STATUS_MAP[course.status] || { label: course.status, cls: 'bg-background text-text-soft' };
  // عدد العناصر من _count (لا نحمّل العناصر في القائمة لتحسين الأداء)
  const elementCount = course._count?.closureElements || 0;

  return (
    <Link href={`/courses/${course.id}`}>
      <div className="flex h-full cursor-pointer flex-col rounded-2xl border border-border bg-white p-4 transition hover:border-primary/30 hover:shadow-card">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm font-extrabold leading-snug text-text-main">{course.name}</h4>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
        </div>
        <p className="mb-3 text-xs text-text-soft">{fmtDate(course.startDate)} — {fmtDate(course.endDate)}</p>
        {elementCount > 0 && (
          <div className="mt-auto text-xs text-text-soft">
            {elementCount} عنصر إقفال
          </div>
        )}
      </div>
    </Link>
  );
}

// ======================================================================
// الصفحة الرئيسية
// ======================================================================

export default function Home() {
  const router = useRouter();
  const { user, activeRole, loading } = useAuth();
  const isAdmin      = isAdminRole(activeRole);
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isEmployee   = activeRole === 'EMPLOYEE';
  const [dash, setDash]           = useState(null);
  const [kpiSnaps, setKpiSnaps]   = useState([]);
  const [pageLoad, setPageLoad]   = useState(true);

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);

  useEffect(() => {
    if (!user || !activeRole) return;
    setPageLoad(true);
    const ep = (isAdmin || isSupervisor) ? '/analytics/manager' : '/analytics/employee';
    Promise.all([
      api.get(ep).catch(() => null),
      (isAdmin || isSupervisor)
        ? api.get('/kpis', { params: { periodType: 'MONTHLY', periodLabel: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}` } }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([dashRes, kpiRes]) => {
      setDash(dashRes?.data || null);
      setKpiSnaps(kpiRes?.data || []);
    }).finally(() => setPageLoad(false));
  }, [user, activeRole, isAdmin, isSupervisor]);

  const donutData = useMemo(() => {
    if (!dash) return [];
    const total  = dash.totalCourses || 0;
    const exec   = dash.executionCourses || 0;
    const await_ = dash.awaitingClosureCourses || 0;
    const prep   = Math.max(0, total - exec - await_ - (dash.closedCourses || 0));
    return [
      { name: 'قيد الإعداد',     value: prep },
      { name: 'قيد التنفيذ',     value: exec },
      { name: 'بانتظار الإغلاق', value: await_ },
      { name: 'مغلقة',           value: dash.closedCourses || 0 },
    ].filter((d) => d.value > 0);
  }, [dash]);

  const teamBarData = useMemo(() => {
    return kpiSnaps
      .filter((s) => s.isSubjectToEvaluation && s.finalScoreDisplay != null)
      .map((s) => ({
        name: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim(),
        score: Number(s.finalScoreDisplay || s.finalScore || 0),
      }));
  }, [kpiSnaps]);

  if (loading || pageLoad) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-text-soft">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !dash) return null;

  const now     = new Date();
  const month   = now.toLocaleString('ar-SA', { month: 'long' });
  const year    = now.getFullYear();

  // ---- stat cards ----
  const statsAdmin = [
    { icon: '📚', label: 'إجمالي الدورات',     value: dash.totalCourses || 0,             color: 'primary', href: '/courses' },
    { icon: '⚡', label: 'قيد التنفيذ الآن',   value: dash.executionCourses || 0,          color: 'primary', href: '/courses?status=EXECUTION' },
    { icon: '🕐', label: 'بانتظار الإغلاق',    value: dash.awaitingClosureCourses || 0,    color: 'amber',   href: '/courses?status=AWAITING_CLOSURE' },
    { icon: '✋', label: 'عناصر تنتظر الاعتماد', value: dash.pendingApprovals || 0,         color: 'red',     href: '/approvals' },
  ];
  const statsEmp = [
    { icon: '📚', label: 'دوراتي',           value: dash.totalCourses || 0,           color: 'primary', href: '/courses' },
    { icon: '⚡', label: 'غير منتهية',       value: dash.openCourses || 0,            color: 'primary', href: '/courses' },
    { icon: '✅', label: 'منتهية',           value: dash.closedCourses || 0,          color: 'green',   href: '/archive' },
    { icon: '⏳', label: 'بانتظار الاعتماد', value: dash.pendingApprovalCourses || 0, color: 'amber',   href: '/courses' },
  ];
  const stats = (isAdmin || isSupervisor) ? statsAdmin : statsEmp;

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ── Banner ── */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-primary-dark p-6 text-white shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">{month} {year}</p>
              <h1 className="mt-1 text-2xl font-extrabold">مرحباً، {user.firstName} 👋</h1>
              <p className="mt-1 text-sm opacity-75">
                {isAdmin ? 'لوحة المدير — نظرة شاملة على أداء الفريق' : isSupervisor ? 'لوحة المشرف — متابعة دورات وأداء مشروعك' : 'لوحتك الشخصية — متابعة دوراتك ومؤشرات أدائك'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateCourse(activeRole) && (
                <Link href="/courses/create"
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/25 transition">
                  + إضافة دورة
                </Link>
              )}
              <Link href="/kpis"
                className="rounded-xl bg-accent/80 px-4 py-2 text-sm font-bold hover:bg-accent transition">
                مؤشرات الأداء
              </Link>
            </div>
          </div>
          {/* خلفية زخرفية */}
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -top-6 left-1/3 h-24 w-24 rounded-full bg-white/5" />
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* ── المدير/المشرف: رسوم بيانية ── */}
        {(isAdmin || isSupervisor) && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

            {/* دونات حالة الدورات */}
            <ChartCard
              title="توزيع الدورات حسب الحالة"
              sub="نظرة عامة على جميع الدورات"
              action={
                <Link href="/courses" className="text-xs font-bold text-primary hover:text-primary-dark">
                  عرض الكل ←
                </Link>
              }
            >
              <StatusDonut data={donutData} />
            </ChartCard>

            {/* مقارنة أداء الفريق */}
            <ChartCard
              title="مقارنة أداء الفريق"
              sub={`مؤشرات الأداء — ${month} ${year}`}
              action={
                <Link href="/kpis" className="text-xs font-bold text-primary hover:text-primary-dark">
                  التفاصيل ←
                </Link>
              }
            >
              <TeamBarChart data={teamBarData} />
            </ChartCard>
          </div>
        )}

        {/* ── معلومات إضافية ── */}
        {(isAdmin || isSupervisor) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* أفضل الموظفين */}
            <ChartCard title="أفضل أداء" sub="بناءً على مؤشرات هذا الشهر">
              {dash.topPerformer ? (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-50 text-2xl">🏆</div>
                  <div>
                    <p className="font-extrabold text-text-main">
                      {dash.topPerformer.user?.firstName} {dash.topPerformer.user?.lastName}
                    </p>
                    <p className="text-xs text-text-soft">{dash.topPerformer.user?.operationalProject?.name}</p>
                    <p className="mt-1 text-lg font-extrabold text-accent">
                      {fmt(dash.topPerformer.finalScore)}%
                    </p>
                  </div>
                </div>
              ) : <p className="py-4 text-center text-sm text-text-soft">لا توجد بيانات KPI</p>}
            </ChartCard>

            {/* تنبيهات */}
            <ChartCard title="تنبيهات التشغيل" sub="يستوجب المتابعة">
              <div className="space-y-2">
                {(dash.endedNotClosedCourses || 0) > 0 && (
                  <AlertItem tone="red" icon="⚠️" text={`${dash.endedNotClosedCourses} دورة انتهت ولم تُقفل`} />
                )}
                {(dash.awaitingClosureCourses || 0) > 0 && (
                  <AlertItem tone="amber" icon="🕐" text={`${dash.awaitingClosureCourses} دورة بانتظار الإغلاق`} />
                )}
                {(dash.pendingApprovals || 0) > 0 && (
                  <AlertItem tone="amber" icon="✋" text={`${dash.pendingApprovals} عنصر ينتظر الاعتماد`} />
                )}
                {!(dash.endedNotClosedCourses || dash.awaitingClosureCourses || dash.pendingApprovals) && (
                  <AlertItem tone="green" icon="✅" text="لا توجد تنبيهات حرجة حالياً" />
                )}
              </div>
            </ChartCard>

            {/* إحصائيات الفريق */}
            <ChartCard title="إحصائيات الفريق" sub="الأعضاء والأداء">
              <div className="space-y-2">
                {[
                  { label: 'الموظفون',       value: dash.employeesCount || 0 },
                  { label: 'مشرفو المشاريع', value: dash.supervisorsCount || 0 },
                  { label: 'متوسط الدرجة',   value: `${fmt(dash.averageScore)}%` },
                  { label: 'لديهم KPI',      value: dash.kpiUsersCount || 0 },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
                    <span className="text-sm text-text-soft">{r.label}</span>
                    <span className="font-extrabold text-primary">{r.value}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        )}

        {/* ── الموظف: مؤشرات KPI ── */}
        {isEmployee && dash.kpi && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'الإنتاجية والإتمام', val: dash.kpi.productivityScore, icon: '📊', color: 'primary' },
              { label: 'جودة التقديم',        val: dash.kpi.qualityScore,      icon: '⭐', color: 'green'   },
              { label: 'الدرجة الكلية',       val: dash.kpi.finalScore,        icon: '🎯',
                color: Number(dash.kpi.finalScore) >= 80 ? 'green' : Number(dash.kpi.finalScore) >= 60 ? 'amber' : 'red' },
            ].map((k) => (
              <Link key={k.label} href="/kpis">
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">{k.icon}</div>
                  <div>
                    <p className="text-xs text-text-soft">{k.label}</p>
                    <p className="text-2xl font-extrabold text-primary">{fmt(k.val)}%</p>
                  </div>
                  <div className="mr-auto h-12 w-12 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="rotate-180">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F0F0EE" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#006C6D" strokeWidth="3"
                        strokeDasharray={`${Math.min(100, Number(k.val) || 0)} 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── آخر الدورات ── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="font-extrabold text-text-main">آخر الدورات</h3>
              <p className="mt-0.5 text-xs text-text-soft">أحدث الدورات المسجلة في النظام</p>
            </div>
            <Link href="/courses" className="text-xs font-bold text-primary hover:text-primary-dark">
              عرض الكل ←
            </Link>
          </div>
          {!dash.latestCourses?.length ? (
            <div className="px-5 py-10 text-center text-sm text-text-soft">لا توجد دورات مسجلة بعد</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {dash.latestCourses.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
