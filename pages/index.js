import dynamic from 'next/dynamic';
import { canCreateCourse, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_MAP = {
  DRAFT:            { label: 'مسودة',            cls: 'bg-border/60 text-text-soft' },
  PREPARATION:      { label: 'قيد الإعداد',      cls: 'bg-background text-text-soft border-border' },
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
// شريط أخبار الموظف المتحرك
// ======================================================================

const TONE_STYLE = {
  green:   'text-accent',
  amber:   'text-warning',
  red:     'text-danger',
  primary: 'text-primary',
};

function NewsTicker({ items }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !items.length) return;
    const el = ref.current;
    let pos = 0;
    const speed = 0.6; // px per frame
    const step = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
      raf = requestAnimationFrame(step);
    };
    let raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  if (!items.length) return null;

  // نضاعف القائمة لتبدو لا نهائية
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-primary/5 py-2 select-none">
      <div className="flex items-center gap-0" ref={ref} style={{ willChange: 'transform', display: 'flex', width: 'max-content' }}>
        {doubled.map((item, i) => (
          <span key={i} className={`flex shrink-0 items-center gap-1.5 px-5 text-xs font-bold ${TONE_STYLE[item.tone] || 'text-text-main'}`}>
            <span>{item.icon}</span>
            <span>{item.text}</span>
            <span className="mx-3 text-border/60">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ======================================================================
// لوحة العناصر المعلّقة للموظف
// ======================================================================

const URGENCY_STYLE = {
  2: { bg: 'border-burgundy/25 bg-burgundy/5',  badge: 'bg-danger/10 text-danger border-danger/20',   icon: '🔴', label: 'متأخر' },
  1: { bg: 'border-sand/40 bg-sand/5',          badge: 'bg-warning/10 text-warning border-sand/40',   icon: '⏳', label: 'يقترب' },
  0: { bg: 'border-border bg-background',        badge: 'bg-primary/10 text-primary border-primary/20', icon: '📋', label: '' },
};

function PendingElementsPanel({ elements }) {
  if (!elements?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-accent/20 bg-forest-50 p-10 text-center h-full min-h-[200px]">
        <span className="text-4xl">🎉</span>
        <div>
          <p className="font-extrabold text-accent">أحسنت! لا توجد عناصر معلّقة</p>
          <p className="text-xs text-text-soft mt-1">جميع عناصرك في دوراتك النشطة مكتملة</p>
        </div>
      </div>
    );
  }

  const urgentCount   = elements.filter(e => e.urgency === 2).length;
  const returnedCount = elements.filter(e => e.status === 'RETURNED').length;
  const rejectedCount = elements.filter(e => e.status === 'REJECTED').length;
  const pendingCount  = elements.filter(e => e.status === 'PENDING_APPROVAL').length;

  // ترتيب أولوية: متأخر > حرج+مُعاد > يقترب > عادي
  const PRIORITY = (e) => {
    let p = 0;
    if (e.urgency === 2) p += 100;
    if (e.status === 'RETURNED') p += 50;
    if (e.isCritical) p += 30;
    if (e.urgency === 1) p += 20;
    return p;
  };
  const sorted = [...elements].sort((a, b) => PRIORITY(b) - PRIORITY(a));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card flex flex-col">
      {/* الرأس */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h3 className="font-extrabold text-text-main">📌 عناصر تحتاج تقديمك</h3>
          <p className="text-[10px] text-text-soft mt-0.5">
            {elements.length} عنصر مرتّبة بالأولوية
            {urgentCount > 0   && <span className="text-danger font-bold"> · {urgentCount} متأخر</span>}
            {returnedCount > 0 && <span className="text-warning font-bold"> · {returnedCount} مُعاد</span>}
            {rejectedCount > 0 && <span className="text-danger font-bold"> · {rejectedCount} مرفوض</span>}
            {pendingCount > 0  && <span className="text-primary font-bold"> · {pendingCount} منتظر اعتماد</span>}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${urgentCount > 0 ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-primary/10 border-primary/20 text-primary'}`}>
          {elements.length}
        </span>
      </div>

      {/* القائمة المسطّحة بالأولوية */}
      <div className="overflow-y-auto max-h-[440px] flex-1 divide-y divide-border/60">
        {sorted.map((el, idx) => {
          const u = URGENCY_STYLE[el.urgency] || URGENCY_STYLE[0];
          const borderColor = el.urgency === 2 ? 'border-r-danger'
            : el.status === 'RETURNED'          ? 'border-r-warning'
            : el.status === 'REJECTED'          ? 'border-r-danger'
            : el.status === 'PENDING_APPROVAL'  ? 'border-r-primary/40'
            : el.isCritical                     ? 'border-r-danger/50'
            : 'border-r-border';
          const icon = el.status === 'RETURNED'         ? '↩'
            : el.status === 'REJECTED'                  ? '❌'
            : el.status === 'PENDING_APPROVAL'          ? '🕐'
            : el.urgency === 2                          ? '🔴'
            : el.urgency === 1                          ? '⚠️'
            : el.isCritical                             ? '⚡'
            : '📋';
          return (
            <Link key={el.id} href={`/courses/${el.courseId}`}>
              <div className={`flex items-center gap-3 px-4 py-3 hover:bg-background transition border-r-4 ${borderColor}`}>
                {/* رقم الأولوية */}
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-border/40 text-[10px] font-extrabold text-text-soft">
                  {idx + 1}
                </span>
                {/* أيقونة الحالة */}
                <span className="shrink-0 text-base">{icon}</span>
                {/* التفاصيل */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="text-xs font-extrabold text-text-main truncate">{el.elementName}</p>
                    {el.isCritical && (
                      <span className="shrink-0 rounded-full bg-danger/10 border border-danger/15 px-1.5 py-px text-[9px] font-extrabold text-danger">حرج</span>
                    )}
                    {el.status === 'RETURNED' && (
                      <span className="shrink-0 rounded-full bg-sand/20 border border-sand/40 px-1.5 py-px text-[9px] font-bold text-warning">مُعاد</span>
                    )}
                    {el.status === 'REJECTED' && (
                      <span className="shrink-0 rounded-full bg-burgundy/10 border border-burgundy/20 px-1.5 py-px text-[9px] font-bold text-danger">مرفوض</span>
                    )}
                    {el.status === 'PENDING_APPROVAL' && (
                      <span className="shrink-0 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-px text-[9px] font-bold text-primary">بانتظار اعتماد</span>
                    )}
                  </div>
                  {/* اسم الدورة كمعلومة ثانوية */}
                  <p className="text-[10px] text-text-soft truncate mt-0.5">{el.courseName}</p>
                </div>
                {/* الوقت المتبقي */}
                {el.hoursLeft != null ? (
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${u.badge}`}>
                    {el.hoursLeft < 0
                      ? `تأخر ${Math.abs(el.hoursLeft)}س`
                      : el.hoursLeft < 24
                      ? `${el.hoursLeft}س`
                      : `${Math.floor(el.hoursLeft / 24)}ي`}
                  </span>
                ) : (
                  <span className="shrink-0 text-text-soft/30 text-xs">←</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
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
  const [dash, setDash]               = useState(null);
  const [kpiSnaps, setKpiSnaps]       = useState([]);
  const [pageLoad, setPageLoad]       = useState(true);
  const [teamPeriod, setTeamPeriod]   = useState('current');
  const [ticker, setTicker]           = useState({ tickerItems: [], pendingElements: [] });

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);

  useEffect(() => {
    if (!user || !activeRole) return;
    setPageLoad(true);
    const ep = (isAdmin || isSupervisor) ? '/analytics/manager' : '/analytics/employee';
    api.get(ep).catch(() => null)
      .then((dashRes) => setDash(dashRes?.data || null))
      .finally(() => setPageLoad(false));

    // شريط الأخبار — للموظف فقط
    if (!isAdmin && !isSupervisor) {
      api.get('/analytics/employee-ticker')
        .then(r => setTicker(r.data || { tickerItems: [], pendingElements: [] }))
        .catch(() => {});
    }
  }, [user, activeRole, isAdmin, isSupervisor]);

  // ── معايير فترة مقارنة أداء الفريق ──
  const teamPeriodParams = useMemo(() => {
    const now = new Date();
    if (teamPeriod === 'year') {
      return { periodType: 'YEARLY', periodLabel: String(now.getFullYear()) };
    }
    if (teamPeriod === 'previous') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { periodType: 'MONTHLY', periodLabel: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    }
    return { periodType: 'MONTHLY', periodLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
  }, [teamPeriod]);

  const teamPeriodLabel = useMemo(() => {
    const now = new Date();
    if (teamPeriod === 'year') return `سنة ${now.getFullYear()}`;
    if (teamPeriod === 'previous') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.toLocaleString('ar-SA-u-ca-gregory', { month: 'long' })} ${d.getFullYear()}`;
    }
    return `${now.toLocaleString('ar-SA-u-ca-gregory', { month: 'long' })} ${now.getFullYear()}`;
  }, [teamPeriod]);

  useEffect(() => {
    if (!user || !activeRole || !(isAdmin || isSupervisor)) return;
    api.get('/kpis', { params: teamPeriodParams })
      .then((res) => setKpiSnaps(res?.data || []))
      .catch(() => setKpiSnaps([]));
  }, [user, activeRole, isAdmin, isSupervisor, teamPeriodParams]);

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

  if (!user) return null;
  if (!dash) return (
    <MainLayout>
      <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-card">
        <p className="text-text-soft text-sm">تعذر تحميل بيانات لوحة التحكم</p>
      </div>
    </MainLayout>
  );

  const now     = new Date();
  const month   = now.toLocaleString('ar-SA-u-ca-gregory', { month: 'long' });
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

        {/* ── شريط الأخبار — موظف فقط ── */}
        {isEmployee && ticker.tickerItems.length > 0 && (
          <NewsTicker items={ticker.tickerItems} />
        )}

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
              sub={`مؤشرات الأداء — ${teamPeriodLabel}`}
              action={
                <div className="flex items-center gap-2">
                  <select
                    value={teamPeriod}
                    onChange={(e) => setTeamPeriod(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="previous">الشهر السابق</option>
                    <option value="current">الشهر الحالي</option>
                    <option value="year">السنة</option>
                  </select>
                  <Link href="/kpis" className="text-xs font-bold text-primary hover:text-primary-dark">
                    التفاصيل ←
                  </Link>
                </div>
              }
            >
              {teamBarData.length ? (
                <TeamBarChart data={teamBarData} />
              ) : (
                <p className="py-6 text-center text-sm text-text-soft">
                  لا توجد بيانات لهذه الفترة{teamPeriod === 'year' ? ' — قد تحتاج لحساب مؤشرات السنة أولاً من صفحة مؤشرات الأداء' : ''}
                </p>
              )}
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

        {/* ── لوحة ترتيب المشاريع ── */}
        {(isAdmin || isSupervisor) && dash.projectLeaderboard?.length > 1 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <h3 className="font-extrabold text-text-main">🏆 ترتيب المشاريع — {month}</h3>
                <p className="text-[11px] text-text-soft mt-0.5">مقارنة متوسط أداء الفرق</p>
              </div>
              <Link href="/kpis" className="text-xs font-bold text-primary hover:text-primary-dark">التفاصيل ←</Link>
            </div>
            <div className="divide-y divide-border">
              {dash.projectLeaderboard.slice(0,4).map((proj, idx) => (
                <div key={proj.projectId} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white
                    ${idx===0?'bg-primary':idx===1?'bg-accent':'bg-text-soft/40'}`}>{idx+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-text-main truncate">{proj.projectName}</p>
                    <p className="text-[10px] text-text-soft">{proj.employeesCount} موظف{proj.topEmployee ? ` · الأفضل: ${proj.topEmployee.name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 overflow-hidden rounded-full bg-forest-50">
                      <div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,proj.avgScore)}%`}} />
                    </div>
                    <span className="text-sm font-extrabold text-primary w-10 text-left">{proj.avgScore}%</span>
                  </div>
                </div>
              ))}
            </div>
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

        {/* ── الموظف: آخر الدورات + لوحة العناصر ── */}
        {isEmployee && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* آخر الدورات — على اليمين (أول عمود في RTL) */}
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="font-extrabold text-text-main">آخر الدورات المضافة</h3>
                  <p className="mt-0.5 text-xs text-text-soft">أحدث دوراتك مع حالة الإقفال</p>
                </div>
                <Link href="/courses" className="text-xs font-bold text-primary hover:text-primary-dark">عرض الكل ←</Link>
              </div>
              {!dash.latestCourses?.length ? (
                <div className="px-5 py-10 text-center text-sm text-text-soft">لا توجد دورات مسجلة بعد</div>
              ) : (
                <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                  {dash.latestCourses.map((c) => {
                    const s = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-background text-text-soft' };
                    return (
                      <Link key={c.id} href={`/courses/${c.id}`}>
                        <div className="flex items-center gap-3 px-5 py-3 hover:bg-background transition">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-bold text-sm text-text-main">{c.name}</p>
                            <p className="text-[10px] text-text-soft mt-0.5">📅 {fmtDate(c.startDate)} — {fmtDate(c.endDate)}</p>
                          </div>
                          <span className="text-text-soft/40 text-xs shrink-0">←</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            {/* لوحة العناصر المعلّقة — على اليسار (ثاني عمود في RTL) */}
            <PendingElementsPanel elements={ticker.pendingElements} />
          </div>
        )}

        {/* ── المدير/المشرف: آخر الدورات المضافة ── */}
        {!isEmployee && (<div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="font-extrabold text-text-main">آخر الدورات المضافة</h3>
              <p className="mt-0.5 text-xs text-text-soft">أحدث 8 دورات — مع الموظف المسؤول وحالة الإقفال</p>
            </div>
            <Link href="/courses" className="text-xs font-bold text-primary hover:text-primary-dark">عرض الكل ←</Link>
          </div>
          {!dash.latestCourses?.length ? (
            <div className="px-5 py-10 text-center text-sm text-text-soft">لا توجد دورات مسجلة بعد</div>
          ) : (
            <div className="divide-y divide-border">
              {dash.latestCourses.map((c) => {
                const s = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-background text-text-soft' };
                const employeeName = c.primaryEmployee
                  ? `${c.primaryEmployee.firstName} ${c.primaryEmployee.lastName}`
                  : '-';
                const pending  = c.closureElements?.filter(e => e.status === 'PENDING_APPROVAL').length || 0;
                const approved = c.closureElements?.filter(e => e.status === 'APPROVED').length || 0;
                const total    = c.closureElements?.filter(e => e.status !== 'NOT_APPLICABLE').length || 0;
                const pct      = total > 0 ? Math.round((approved / total) * 100) : 0;
                return (
                  <Link key={c.id} href={`/courses/${c.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-background transition">
                      {/* حالة */}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                      {/* اسم + موظف */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-bold text-sm text-text-main">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-soft">
                          <span>👤 {employeeName}</span>
                          <span>·</span>
                          <span>📅 {fmtDate(c.startDate)} — {fmtDate(c.endDate)}</span>
                        </div>
                      </div>
                      {/* شريط إنجاز الإقفال */}
                      {total > 0 && (
                        <div className="shrink-0 w-28 space-y-1 hidden sm:block">
                          <div className="flex justify-between text-[10px] text-text-soft">
                            <span>{approved}/{total} عنصر</span>
                            {pending > 0 && <span className="text-warning font-bold">{pending} منتظر</span>}
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-forest-50">
                            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>)}

      </div>
    </MainLayout>
  );
}
