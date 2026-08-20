import dynamic from 'next/dynamic';
import { canCreateCourse, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  BookOpen,
  Zap,
  Clock,
  ClipboardCheck,
  CheckCircle2,
  Hourglass,
  Trophy,
  AlertTriangle,
  BarChart3,
  Star,
  Target,
  User,
  Calendar,
  Plus,
  ArrowRight,
} from 'lucide-react';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import { useTranslation } from '../lib/i18n';

const StatusDonut = dynamic(() => import('../components/charts/StatusDonut'), { ssr: false });
const TeamBarChart = dynamic(() => import('../components/charts/TeamBarChart'), { ssr: false });

function fmt(v, d = 1) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

// أنماط حالة الدورة (التسميات من الترجمة)
const STATUS_CLS = {
  DRAFT: 'bg-border/60 text-text-soft',
  PREPARATION: 'bg-background text-text-soft border-border',
  EXECUTION: 'bg-primary-light text-primary',
  AWAITING_CLOSURE: 'bg-sand/20 text-warning border-sand/40',
  CLOSED: 'bg-forest-50 text-accent border-accent/20',
  ARCHIVED: 'bg-border text-text-soft',
};

function StatCard({ Icon, label, value, sub, color = 'primary', href }) {
  const colors = {
    primary: { bg: 'bg-primary-light', text: 'text-primary', border: 'border-primary/20', val: 'text-primary' },
    amber: { bg: 'bg-sand/20', text: 'text-warning', border: 'border-sand/40', val: 'text-warning' },
    red: { bg: 'bg-burgundy/10', text: 'text-danger', border: 'border-burgundy/20', val: 'text-danger' },
    green: { bg: 'bg-forest-50', text: 'text-accent', border: 'border-accent/20', val: 'text-accent' },
  };
  const c = colors[color] || colors.primary;
  const inner = (
    <div className={`group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${c.border}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
        {Icon && <Icon size={22} aria-hidden="true" />}
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

function AlertItem({ Icon, text, tone = 'amber' }) {
  const cls = {
    amber: 'border-sand/40 bg-sand/10 text-warning',
    red: 'border-burgundy/20 bg-burgundy/5 text-danger',
    green: 'border-accent/20 bg-forest-50 text-accent',
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${cls[tone] || cls.amber}`}>
      {Icon && <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, activeRole, loading } = useAuth();
  const { t, locale } = useTranslation();
  const isAdmin = isAdminRole(activeRole);
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isEmployee = activeRole === 'EMPLOYEE';
  const [dash, setDash] = useState(null);
  const [kpiSnaps, setKpiSnaps] = useState([]);
  const [pageLoad, setPageLoad] = useState(true);
  const [teamPeriod, setTeamPeriod] = useState('current');

  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(intl, { year: 'numeric', month: 'short', day: 'numeric' }) : '-');
  const statusLabel = (status) => t(`courseStatus.${status === 'DRAFT' ? 'PREPARATION' : status === 'IN_PROGRESS' ? 'EXECUTION' : status}`);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !activeRole) return;
    setPageLoad(true);
    const ep = isAdmin || isSupervisor ? '/analytics/manager' : '/analytics/employee';
    api
      .get(ep)
      .catch(() => null)
      .then((dashRes) => setDash(dashRes?.data || null))
      .finally(() => setPageLoad(false));
  }, [user, activeRole, isAdmin, isSupervisor]);

  const teamPeriodParams = useMemo(() => {
    const now = new Date();
    if (teamPeriod === 'year') return { periodType: 'YEARLY', periodLabel: String(now.getFullYear()) };
    if (teamPeriod === 'previous') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { periodType: 'MONTHLY', periodLabel: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    }
    return { periodType: 'MONTHLY', periodLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
  }, [teamPeriod]);

  const teamPeriodLabel = useMemo(() => {
    const now = new Date();
    if (teamPeriod === 'year') return t('dashboard.yearLabel', { year: now.getFullYear() });
    if (teamPeriod === 'previous') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.toLocaleString(intl, { month: 'long' })} ${d.getFullYear()}`;
    }
    return `${now.toLocaleString(intl, { month: 'long' })} ${now.getFullYear()}`;
  }, [teamPeriod, t, intl]);

  useEffect(() => {
    if (!user || !activeRole || !(isAdmin || isSupervisor)) return;
    api
      .get('/kpis', { params: teamPeriodParams })
      .then((res) => setKpiSnaps(res?.data || []))
      .catch(() => setKpiSnaps([]));
  }, [user, activeRole, isAdmin, isSupervisor, teamPeriodParams]);

  const donutData = useMemo(() => {
    if (!dash) return [];
    const total = dash.totalCourses || 0;
    const exec = dash.executionCourses || 0;
    const await_ = dash.awaitingClosureCourses || 0;
    const prep = Math.max(0, total - exec - await_ - (dash.closedCourses || 0));
    return [
      { name: t('courseStatus.PREPARATION'), value: prep },
      { name: t('courseStatus.EXECUTION'), value: exec },
      { name: t('courseStatus.AWAITING_CLOSURE'), value: await_ },
      { name: t('courseStatus.CLOSED'), value: dash.closedCourses || 0 },
    ].filter((d) => d.value > 0);
  }, [dash, t]);

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
          <p className="text-sm text-text-soft">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (!dash)
    return (
      <MainLayout>
        <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-card">
          <p className="text-sm text-text-soft">{t('dashboard.loadFailed')}</p>
        </div>
      </MainLayout>
    );

  const now = new Date();
  const month = now.toLocaleString(intl, { month: 'long' });
  const year = now.getFullYear();

  const statsAdmin = [
    { Icon: BookOpen, label: t('dashboard.statTotalCourses'), value: dash.totalCourses || 0, color: 'primary', href: '/courses' },
    { Icon: Zap, label: t('dashboard.statExecutionNow'), value: dash.executionCourses || 0, color: 'primary', href: '/courses?status=EXECUTION' },
    { Icon: Clock, label: t('dashboard.statAwaitingClosure'), value: dash.awaitingClosureCourses || 0, color: 'amber', href: '/courses?status=AWAITING_CLOSURE' },
    { Icon: ClipboardCheck, label: t('dashboard.statPendingElements'), value: dash.pendingApprovals || 0, color: 'red', href: '/approvals' },
  ];
  const statsEmp = [
    { Icon: BookOpen, label: t('dashboard.statMyCourses'), value: dash.totalCourses || 0, color: 'primary', href: '/courses' },
    { Icon: Zap, label: t('dashboard.statOpen'), value: dash.openCourses || 0, color: 'primary', href: '/courses' },
    { Icon: CheckCircle2, label: t('dashboard.statClosed'), value: dash.closedCourses || 0, color: 'green', href: '/archive' },
    { Icon: Hourglass, label: t('dashboard.statAwaitingApproval'), value: dash.pendingApprovalCourses || 0, color: 'amber', href: '/courses' },
  ];
  const stats = isAdmin || isSupervisor ? statsAdmin : statsEmp;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-primary-dark p-6 text-white shadow-soft">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">{month} {year}</p>
              <h1 className="mt-1 text-2xl font-extrabold">{t('dashboard.greeting', { name: user.firstName })}</h1>
              <p className="mt-1 text-sm opacity-75">{isAdmin ? t('dashboard.subAdmin') : isSupervisor ? t('dashboard.subSupervisor') : t('dashboard.subEmployee')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateCourse(activeRole) && (
                <Link href="/courses/create" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur transition hover:bg-white/25">
                  <Plus size={16} aria-hidden="true" /> {t('course.addCourse')}
                </Link>
              )}
              <Link href="/kpis" className="rounded-xl bg-accent/80 px-4 py-2 text-sm font-bold transition hover:bg-accent">
                {t('nav.kpis')}
              </Link>
            </div>
          </div>
          {/* علامة نجمة الجامعة الذهبية — زخرفة */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels4_profile.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 z-0 h-44 w-44 rounded-[2rem] opacity-20 mix-blend-screen end-4"
          />
          <div className="pointer-events-none absolute -top-8 z-0 h-28 w-28 rounded-full bg-white/5 start-1/4" />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* المدير/المشرف: رسوم بيانية */}
        {(isAdmin || isSupervisor) && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title={t('dashboard.distribution')}
              sub={t('dashboard.distributionSub')}
              action={
                <Link href="/courses" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">
                  {t('dashboard.viewAll')} <ArrowRight size={12} aria-hidden="true" />
                </Link>
              }
            >
              <StatusDonut data={donutData} />
            </ChartCard>

            <ChartCard
              title={t('dashboard.teamComparison')}
              sub={t('dashboard.teamComparisonSub', { period: teamPeriodLabel })}
              action={
                <div className="flex items-center gap-2">
                  <select
                    value={teamPeriod}
                    onChange={(e) => setTeamPeriod(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="previous">{t('dashboard.previousMonth')}</option>
                    <option value="current">{t('dashboard.currentMonth')}</option>
                    <option value="year">{t('dashboard.year')}</option>
                  </select>
                  <Link href="/kpis" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">
                    {t('dashboard.details')} <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              }
            >
              {teamBarData.length ? (
                <TeamBarChart data={teamBarData} />
              ) : (
                <p className="py-6 text-center text-sm text-text-soft">
                  {t('dashboard.noPeriodData')}
                  {teamPeriod === 'year' ? t('dashboard.noPeriodDataYear') : ''}
                </p>
              )}
            </ChartCard>
          </div>
        )}

        {/* معلومات إضافية */}
        {(isAdmin || isSupervisor) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ChartCard title={t('dashboard.topPerformance')} sub={t('dashboard.topPerformanceSub')}>
              {dash.topPerformer ? (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-50 text-accent">
                    <Trophy size={26} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-extrabold text-text-main">{dash.topPerformer.user?.firstName} {dash.topPerformer.user?.lastName}</p>
                    <p className="text-xs text-text-soft">{dash.topPerformer.user?.operationalProject?.name}</p>
                    <p className="mt-1 text-lg font-extrabold text-accent">{fmt(dash.topPerformer.finalScore)}%</p>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-text-soft">{t('dashboard.noKpiData')}</p>
              )}
            </ChartCard>

            <ChartCard title={t('dashboard.opAlerts')} sub={t('dashboard.opAlertsSub')}>
              <div className="space-y-2">
                {(dash.endedNotClosedCourses || 0) > 0 && <AlertItem tone="red" Icon={AlertTriangle} text={t('dashboard.alertEndedNotClosed', { count: dash.endedNotClosedCourses })} />}
                {(dash.awaitingClosureCourses || 0) > 0 && <AlertItem tone="amber" Icon={Clock} text={t('dashboard.alertAwaitingClosure', { count: dash.awaitingClosureCourses })} />}
                {(dash.pendingApprovals || 0) > 0 && <AlertItem tone="amber" Icon={ClipboardCheck} text={t('dashboard.alertPendingApprovals', { count: dash.pendingApprovals })} />}
                {!(dash.endedNotClosedCourses || dash.awaitingClosureCourses || dash.pendingApprovals) && <AlertItem tone="green" Icon={CheckCircle2} text={t('dashboard.noAlerts')} />}
              </div>
            </ChartCard>

            <ChartCard title={t('dashboard.teamStats')} sub={t('dashboard.teamStatsSub')}>
              <div className="space-y-2">
                {[
                  { label: t('dashboard.employees'), value: dash.employeesCount || 0 },
                  { label: t('dashboard.projectSupervisors'), value: dash.supervisorsCount || 0 },
                  { label: t('dashboard.avgScore'), value: `${fmt(dash.averageScore)}%` },
                  { label: t('dashboard.haveKpi'), value: dash.kpiUsersCount || 0 },
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

        {/* لوحة ترتيب المشاريع */}
        {(isAdmin || isSupervisor) && dash.projectLeaderboard?.length > 1 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <h3 className="inline-flex items-center gap-1.5 font-extrabold text-text-main">
                  <Trophy size={16} aria-hidden="true" className="text-accent" /> {t('dashboard.projectRanking', { month })}
                </h3>
                <p className="mt-0.5 text-[11px] text-text-soft">{t('dashboard.projectRankingSub')}</p>
              </div>
              <Link href="/kpis" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">
                {t('dashboard.details')} <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {dash.projectLeaderboard.slice(0, 4).map((proj, idx) => (
                <div key={proj.projectId} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-accent' : 'bg-text-soft/40'}`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text-main">{proj.projectName}</p>
                    <p className="text-[10px] text-text-soft">
                      {t('dashboard.employeeCount', { count: proj.employeesCount })}
                      {proj.topEmployee ? ` · ${t('dashboard.best', { name: proj.topEmployee.name })}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-forest-50">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, proj.avgScore)}%` }} />
                    </div>
                    <span className="w-10 text-start text-sm font-extrabold text-primary">{proj.avgScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الموظف: مؤشرات */}
        {isEmployee && dash.kpi && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: t('dashboard.productivity'), val: dash.kpi.productivityScore, Icon: BarChart3 },
              { label: t('dashboard.quality'), val: dash.kpi.qualityScore, Icon: Star },
              { label: t('dashboard.totalScore'), val: dash.kpi.finalScore, Icon: Target },
            ].map((k) => (
              <Link key={k.label} href="/kpis">
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <k.Icon size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-text-soft">{k.label}</p>
                    <p className="text-2xl font-extrabold text-primary">{fmt(k.val)}%</p>
                  </div>
                  <div className="ms-auto h-12 w-12 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="rotate-180">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F0F0EE" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#006C6D" strokeWidth="3" strokeDasharray={`${Math.min(100, Number(k.val) || 0)} 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* آخر الدورات المضافة */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="font-extrabold text-text-main">{t('dashboard.latestCourses')}</h3>
              <p className="mt-0.5 text-xs text-text-soft">{t('dashboard.latestCoursesSub')}</p>
            </div>
            <Link href="/courses" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark">
              {t('dashboard.viewAll')} <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          {!dash.latestCourses?.length ? (
            <div className="px-5 py-10 text-center text-sm text-text-soft">{t('dashboard.noCoursesYet')}</div>
          ) : (
            <div className="divide-y divide-border">
              {dash.latestCourses.map((c) => {
                const employeeName = c.primaryEmployee ? `${c.primaryEmployee.firstName} ${c.primaryEmployee.lastName}` : '-';
                const pending = c.closureElements?.filter((e) => e.status === 'PENDING_APPROVAL').length || 0;
                const approved = c.closureElements?.filter((e) => e.status === 'APPROVED').length || 0;
                const total = c.closureElements?.filter((e) => e.status !== 'NOT_APPLICABLE').length || 0;
                const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
                return (
                  <Link key={c.id} href={`/courses/${c.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 transition hover:bg-background">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[c.status] || 'bg-background text-text-soft'}`}>{statusLabel(c.status)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-text-main">{c.name}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-soft">
                          <span className="inline-flex items-center gap-1">
                            <User size={12} aria-hidden="true" /> {employeeName}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} aria-hidden="true" /> {fmtDate(c.startDate)} — {fmtDate(c.endDate)}
                          </span>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="hidden w-28 shrink-0 space-y-1 sm:block">
                          <div className="flex justify-between text-[10px] text-text-soft">
                            <span>{t('dashboard.elementsApprovedOfTotal', { approved, total })}</span>
                            {pending > 0 && <span className="font-bold text-warning">{t('dashboard.pendingShort', { count: pending })}</span>}
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
        </div>
      </div>
    </MainLayout>
  );
}
