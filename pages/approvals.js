import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Search,
  RefreshCw,
  Check,
  X,
  RotateCcw,
  Undo2,
  Hourglass,
  Circle,
  AlertTriangle,
  ChevronDown,
  Users,
  CheckCircle2,
  FileText,
  FileCheck,
  Coins,
  ReceiptText,
  GraduationCap,
  BarChart3,
  Package,
  Award,
  Pencil,
  Mail,
  Star,
  HeartPulse,
  User,
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import useAuth from '../context/AuthContext';
import { useTranslation } from '../lib/i18n';

// ── أدوات ──────────────────────────────────────────────────────
function intlOf(locale) {
  return locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
}
function fmtDT(intl, v) {
  if (!v) return '-';
  return new Date(v).toLocaleString(intl, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(intl, v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString(intl, { year: 'numeric', month: 'short', day: 'numeric' });
}
function waitLabel(t, h) {
  if (h < 1) return t('approvals.waitLessHour');
  if (h < 24) return t('approvals.waitHours', { h });
  const d = Math.floor(h / 24), r = h % 24;
  return r > 0 ? t('approvals.waitDaysHours', { d, h: r }) : t('approvals.waitDays', { d });
}

const ELEMENT_ICON = {
  opening_report: FileText, closing_report: FileCheck, advance_req: Coins, settlement: ReceiptText,
  supervisor_compensation: User, trainer_compensation: GraduationCap, revenues: BarChart3,
  materials: Package, certificates: Award, pre_test: Pencil, post_test: CheckCircle2,
  trainee_registration: Users, registration_message: Mail, reaction_evaluation: Star, medical_insurance: HeartPulse,
};

const STATUS_COURSE_CLS = {
  PREPARATION: 'bg-background text-text-soft',
  EXECUTION: 'bg-primary-light text-primary',
  AWAITING_CLOSURE: 'bg-sand/20 text-warning',
  CLOSED: 'bg-forest-50 text-accent',
};

// ── حلقة النسبة ────────────────────────────────────────────────
function Ring({ pct, size = 56, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  const col = color || (pct >= 80 ? '#5D8A70' : pct >= 50 ? '#C3B39F' : '#633646');
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EBF3EE" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
    </svg>
  );
}

function StackedBar({ approved, pending, returned, notStarted, total }) {
  const { t } = useTranslation();
  if (!total) return null;
  const w = (n) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-border/30">
      {approved > 0 && <div className="h-full bg-accent transition-all" style={{ width: w(approved) }} title={`${t('approvals.legendApproved')}: ${approved}`} />}
      {pending > 0 && <div className="h-full bg-warning transition-all" style={{ width: w(pending) }} title={`${t('approvals.pendingShort', { count: pending })}`} />}
      {returned > 0 && <div className="h-full bg-danger transition-all" style={{ width: w(returned) }} title={`${t('approvals.returnedShort', { count: returned })}`} />}
      {notStarted > 0 && <div className="h-full bg-border transition-all" style={{ width: w(notStarted) }} title={t('approvals.legendNotStarted')} />}
    </div>
  );
}

// ══ لوحة مراقبة المدير ══════════════════════════════════════════
function CourseOversightRow({ course }) {
  const { t, locale } = useTranslation();
  const intl = intlOf(locale);
  const cls = STATUS_COURSE_CLS[course.status] || 'bg-background text-text-soft';
  const statusLabel = t(`courseStatus.${course.status}`);
  const { approved, pending, returned, notStarted, total } = course.elements;
  return (
    <Link href={`/courses/${course.id}`}>
      <div className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition hover:border-primary/30 hover:bg-background ${course.isOverdue ? 'border-danger/20 bg-burgundy/5' : 'border-border bg-white'}`}>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{statusLabel}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text-main">{course.name}</p>
          <p className="mt-0.5 text-[10px] text-text-soft">
            {fmtDate(intl, course.startDate)} — {fmtDate(intl, course.endDate)}
            {course.isOverdue && <span className="ms-2 inline-flex items-center gap-0.5 font-bold text-danger"><AlertTriangle size={10} aria-hidden="true" /> {t('approvals.overdue')}</span>}
          </p>
        </div>
        <div className="hidden w-40 shrink-0 space-y-1.5 sm:block">
          <StackedBar approved={approved} pending={pending} returned={returned} notStarted={notStarted} total={total} />
          <div className="flex justify-between gap-2 text-[10px]">
            {approved > 0 && <span className="inline-flex items-center gap-0.5 font-bold text-accent"><Check size={10} aria-hidden="true" />{approved}</span>}
            {pending > 0 && <span className="inline-flex items-center gap-0.5 font-bold text-warning"><Hourglass size={10} aria-hidden="true" />{pending}</span>}
            {returned > 0 && <span className="inline-flex items-center gap-0.5 font-bold text-danger"><Undo2 size={10} aria-hidden="true" />{returned}</span>}
            {notStarted > 0 && <span className="inline-flex items-center gap-0.5 text-text-soft"><Circle size={9} aria-hidden="true" />{notStarted}</span>}
          </div>
        </div>
        <span className={`w-10 shrink-0 text-start text-sm font-extrabold ${course.completionPct >= 80 ? 'text-accent' : course.completionPct >= 50 ? 'text-warning' : 'text-danger'}`}>{course.completionPct}%</span>
      </div>
    </Link>
  );
}

function EmployeeOversightCard({ emp }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(emp.summary.overdueCourses > 0 || emp.summary.pendingElements > 0);
  const { completionPct, totalCourses, overdueCourses, approvedElements, totalElements, pendingElements, returnedElements } = emp.summary;
  const hasIssues = overdueCourses > 0 || returnedElements > 0;
  const hasPending = pendingElements > 0;

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-card transition ${hasIssues ? 'border-danger/25' : hasPending ? 'border-warning/25' : 'border-border'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-4 px-5 py-4 text-start transition hover:bg-background ${hasIssues ? 'bg-burgundy/5' : hasPending ? 'bg-sand/10' : 'bg-white'}`}
      >
        <div className="relative shrink-0">
          <Ring pct={completionPct} size={60} stroke={5} />
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-text-main">{completionPct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-text-main">{emp.name}</p>
          <p className="text-xs text-text-soft">{emp.projectName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-text-soft">{t('approvals.coursesCount', { count: totalCourses })}</span>
            <span className="inline-flex items-center gap-0.5 rounded-full border border-accent/20 bg-forest-50 px-2 py-0.5 text-[10px] font-bold text-accent">
              <Check size={10} aria-hidden="true" /> {approvedElements}/{totalElements}
            </span>
            {pendingElements > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-sand/40 bg-sand/20 px-2 py-0.5 text-[10px] font-bold text-warning">
                <Hourglass size={10} aria-hidden="true" /> {t('approvals.pendingShort', { count: pendingElements })}
              </span>
            )}
            {returnedElements > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-burgundy/20 bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                <Undo2 size={10} aria-hidden="true" /> {t('approvals.returnedShort', { count: returnedElements })}
              </span>
            )}
            {overdueCourses > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-burgundy/20 bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                <AlertTriangle size={10} aria-hidden="true" /> {t('approvals.overdueCoursesShort', { count: overdueCourses })}
              </span>
            )}
          </div>
        </div>
        <div className="hidden w-32 shrink-0 space-y-1 md:block">
          <StackedBar approved={approvedElements} pending={pendingElements} returned={returnedElements} notStarted={totalElements - approvedElements - pendingElements - returnedElements} total={totalElements} />
          <div className="flex justify-between text-[10px] text-text-soft">
            <span className="inline-flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-accent" /> {t('approvals.legendApproved')}</span>
            <span className="inline-flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-warning" /></span>
            <span className="inline-flex items-center gap-0.5"><span className="h-2 w-2 rounded-full bg-danger" /></span>
          </div>
        </div>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border bg-background p-4">
          {emp.courses.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-soft">{t('approvals.noCourses')}</p>
          ) : (
            emp.courses.map((c) => <CourseOversightRow key={c.id} course={c} />)
          )}
        </div>
      )}
    </div>
  );
}

function ManagerOversight() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    api
      .get('/analytics/oversight')
      .then((r) => setEmployees(r.data?.employees || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = employees
    .filter((e) => {
      if (filter === 'issues') return e.summary.overdueCourses > 0 || e.summary.returnedElements > 0;
      if (filter === 'pending') return e.summary.pendingElements > 0;
      return true;
    })
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.projectName.toLowerCase().includes(q));

  const totalPending = employees.reduce((s, e) => s + e.summary.pendingElements, 0);
  const totalOverdue = employees.reduce((s, e) => s + e.summary.overdueCourses, 0);
  const totalReturned = employees.reduce((s, e) => s + e.summary.returnedElements, 0);

  const filters = [
    { val: 'all', label: t('common.all'), Icon: null },
    { val: 'issues', label: t('approvals.filterIssues'), Icon: AlertTriangle },
    { val: 'pending', label: t('approvals.filterPending'), Icon: Hourglass },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold text-primary">{t('approvals.oversightTitle')}</h1>
            <p className="mt-0.5 text-xs text-text-soft">{t('approvals.oversightSub')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {totalOverdue > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                <AlertTriangle size={13} aria-hidden="true" /> {t('approvals.overdueCourses', { count: totalOverdue })}
              </span>
            )}
            {totalPending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-warning/30 bg-sand/10 px-3 py-2 text-xs font-bold text-warning">
                <Hourglass size={13} aria-hidden="true" /> {t('approvals.pendingElements', { count: totalPending })}
              </span>
            )}
            {totalReturned > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                <Undo2 size={13} aria-hidden="true" /> {t('approvals.returnedElements', { count: totalReturned })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border px-5 py-2.5 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-accent" /><span className="text-text-soft">{t('approvals.legendApproved')}</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-warning" /><span className="text-text-soft">{t('approvals.legendPending')}</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-danger" /><span className="text-text-soft">{t('approvals.legendReturned')}</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-border" /><span className="text-text-soft">{t('approvals.legendNotStarted')}</span></span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('approvals.searchEmployee')} className="w-full rounded-xl border border-border py-2 text-sm outline-none focus:border-primary ps-9 pe-3" />
          </div>
          {filters.map((o) => (
            <button
              key={o.val}
              onClick={() => setFilter(o.val)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${filter === o.val ? 'border-primary bg-primary-light text-primary' : 'border-border bg-white text-text-soft hover:border-primary/40'}`}
            >
              {o.Icon && <o.Icon size={13} aria-hidden="true" />} {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-20 text-center shadow-card">
          <Users size={32} aria-hidden="true" className="mx-auto mb-2 text-text-soft/50" />
          <p className="font-extrabold text-text-main">{t('approvals.noResults')}</p>
          <p className="mt-1 text-sm text-text-soft">{t('approvals.tryChangeFilter')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((emp) => (
            <EmployeeOversightCard key={emp.id} emp={emp} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══ قائمة اعتمادات المشرف ════════════════════════════════════════
function WaitBadge({ hours }) {
  const { t } = useTranslation();
  const label = waitLabel(t, hours);
  if (hours < 6) return <span className="rounded-full border border-accent/20 bg-forest-50 px-2 py-0.5 text-[10px] font-bold text-accent">{label}</span>;
  if (hours < 24) return <span className="rounded-full border border-sand/40 bg-sand/20 px-2 py-0.5 text-[10px] font-bold text-warning">{label}</span>;
  if (hours < 48)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
        <AlertTriangle size={10} aria-hidden="true" /> {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-burgundy/20 bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger">
      <AlertTriangle size={10} aria-hidden="true" /> {label}
    </span>
  );
}

function ApprovalElementRow({ item, onDecide, busyId }) {
  const { t, locale } = useTranslation();
  const intl = intlOf(locale);
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const busy = busyId === item.id;
  const ElIcon = ELEMENT_ICON[item.elementKey] || FileText;

  const confirm = async (status) => {
    if ((status === 'RETURNED' || status === 'REJECTED') && !reason.trim()) {
      toast.error(t('courseDetail.reasonRequired'));
      return;
    }
    await onDecide(item.id, status, reason);
    setMode(null);
    setReason('');
  };

  return (
    <div className={`space-y-2 rounded-xl border bg-white p-3 ${item.isCritical ? 'border-danger/30' : item.isUrgent ? 'border-warning/30' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <ElIcon size={18} aria-hidden="true" className="mt-0.5 text-text-soft" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-main">{item.elementName}</p>
            <Link href={`/courses/${item.courseId}`} className="block truncate text-xs font-bold text-primary hover:underline">
              {item.courseName} {item.courseCode && <span className="font-normal text-text-soft">· {item.courseCode}</span>}
            </Link>
          </div>
        </div>
        <WaitBadge hours={item.waitHours} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary-light px-2 py-1 font-bold text-primary">
          <Check size={11} aria-hidden="true" /> {t('approvals.submittedBy', { name: item.employeeName, date: fmtDT(intl, item.submittedAt) })}
        </span>
        {item.wasReturned && (
          <>
            <span className="text-text-soft">→</span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-sand/40 bg-sand/20 px-2 py-1 font-bold text-warning"><Undo2 size={11} aria-hidden="true" /> {t('approvals.returnedStep')}</span>
            <span className="text-text-soft">→</span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary-light px-2 py-1 font-bold text-primary"><Check size={11} aria-hidden="true" /> {t('approvals.resubmittedStep')}</span>
          </>
        )}
        <span className="text-text-soft">→</span>
        <span className="inline-flex animate-pulse items-center gap-1 rounded-lg border border-sand/30 bg-sand/10 px-2 py-1 font-bold text-warning"><Hourglass size={11} aria-hidden="true" /> {t('approvals.awaitingYourDecision')}</span>
      </div>

      {item.wasReturned && item.notes && (
        <div className="rounded-lg border border-sand/40 bg-sand/10 px-3 py-1.5 text-xs text-warning">
          <span className="font-bold">{t('approvals.previousReturnReason')}</span>
          {item.notes}
        </div>
      )}
      {item.delayReason && (
        <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-soft">
          <span className="font-bold text-text-main">{t('approvals.employeeJustification')}</span>
          {item.delayReason}
        </div>
      )}

      {!mode ? (
        <div className="flex gap-2 pt-0.5">
          <button onClick={() => onDecide(item.id, 'APPROVED', '')} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? '...' : (<><Check size={13} aria-hidden="true" /> {t('element.approve')}</>)}
          </button>
          <button onClick={() => { setMode('RETURNED'); setReason(''); }} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-warning px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            <RotateCcw size={13} aria-hidden="true" /> {t('approvals.return')}
          </button>
          <button onClick={() => { setMode('REJECTED'); setReason(''); }} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            <X size={13} aria-hidden="true" /> {t('element.reject')}
          </button>
        </div>
      ) : (
        <div className={`space-y-2 rounded-xl border p-3 ${mode === 'RETURNED' ? 'border-sand/40 bg-sand/10' : 'border-burgundy/20 bg-burgundy/5'}`}>
          <p className={`text-xs font-bold ${mode === 'RETURNED' ? 'text-warning' : 'text-danger'}`}>{mode === 'RETURNED' ? t('element.returnReasonLabel') : t('element.rejectReasonLabel')}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder={t('approvals.explainToEmployee')}
            className="w-full resize-none rounded-lg border border-white/60 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-current"
          />
          <div className="flex gap-2">
            <button onClick={() => confirm(mode)} disabled={busy} className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${mode === 'RETURNED' ? 'bg-warning' : 'bg-danger'}`}>
              {busy ? '...' : t('common.confirm')}
            </button>
            <button onClick={() => setMode(null)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-soft">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupervisorApprovals() {
  const { t } = useTranslation();
  const [grouped, setGrouped] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/approvals-queue');
      const g = res.data?.grouped || [];
      setGrouped(g);
      setTotal(res.data?.total || 0);
      const autoOpen = new Set(g.filter((x) => x.criticalCount > 0 || x.urgentCount > 0).map((x) => x.employeeId));
      setOpenIds(autoOpen);
    } catch {
      setGrouped([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDecide = async (id, status, notes) => {
    setBusyId(id);
    try {
      await api.put(`/closure/${id}`, { status, notes });
      toast.success(status === 'APPROVED' ? t('element.toast.approved') : status === 'RETURNED' ? t('approvals.returnedToEmployee') : t('approvals.rejectedDone'));
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('approvals.decideFailed'));
    } finally {
      setBusyId('');
    }
  };

  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? grouped.map((g) => ({ ...g, items: g.items.filter((i) => [i.employeeName, i.courseName, i.elementName].some((v) => v?.toLowerCase().includes(q))) })).filter((g) => g.items.length > 0)
    : grouped;

  const urgent = grouped.reduce((s, g) => s + g.urgentCount, 0);
  const critical = grouped.reduce((s, g) => s + g.criticalCount, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold text-primary">{t('approvals.queueTitle')}</h1>
            <p className="mt-0.5 text-xs text-text-soft">{t('approvals.queueSub')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {critical > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                <AlertTriangle size={13} aria-hidden="true" /> {t('approvals.over48', { count: critical })}
              </span>
            )}
            {urgent > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-warning/30 bg-sand/10 px-3 py-2 text-xs font-bold text-warning">
                <AlertTriangle size={13} aria-hidden="true" /> {t('approvals.over24', { count: urgent - critical })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text-main">
              {t('common.total')} <span className="ms-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">{total}</span>
            </span>
            <button onClick={load} aria-label={t('common.refresh')} className="rounded-xl border border-border bg-white px-3 py-2 text-text-soft hover:bg-background">
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3">
          <div className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('approvals.searchQueue')} className="w-full rounded-xl border border-border py-2 text-sm outline-none focus:border-primary ps-9 pe-3" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-20 text-center shadow-card">
          <CheckCircle2 size={32} aria-hidden="true" className="mx-auto mb-2 text-accent/60" />
          <p className="font-extrabold text-text-main">{q ? t('approvals.noResultsShort') : t('approvals.allApproved')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => {
            const isOpen = openIds.has(group.employeeId);
            return (
              <div key={group.employeeId} className={`overflow-hidden rounded-2xl border shadow-card ${group.criticalCount > 0 ? 'border-danger/30' : group.urgentCount > 0 ? 'border-warning/30' : 'border-border'}`}>
                <button
                  onClick={() => toggleOpen(group.employeeId)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 transition hover:bg-background ${group.criticalCount > 0 ? 'bg-burgundy/5' : group.urgentCount > 0 ? 'bg-sand/10' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${group.criticalCount > 0 ? 'bg-danger' : group.urgentCount > 0 ? 'bg-warning' : 'bg-primary'}`}>
                      {(group.employeeName || '?').charAt(0)}
                    </div>
                    <div className="text-start">
                      <p className="font-extrabold text-text-main">{group.employeeName}</p>
                      <p className="text-xs text-text-soft">{group.projectName}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">{t('course.elementsCount', { count: group.items.length })}</span>
                    {group.criticalCount > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white"><AlertTriangle size={10} aria-hidden="true" /> {group.criticalCount}</span>}
                    {group.urgentCount > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white"><AlertTriangle size={10} aria-hidden="true" /> {group.urgentCount}</span>}
                    <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <ApprovalElementRow key={item.id} item={item} onDecide={handleDecide} busyId={busyId} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const { activeRole } = useAuth();
  const isManager = activeRole === 'MANAGER';

  return <MainLayout>{isManager ? <ManagerOversight /> : <SupervisorApprovals />}</MainLayout>;
}
