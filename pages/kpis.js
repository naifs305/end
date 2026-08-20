import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Package,
  Clock,
  Star,
  Target,
  Zap,
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
  Pencil,
  Check,
  Trophy,
  Crown,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from '../lib/i18n';

const RadarKPI     = dynamic(() => import('../components/charts/RadarKPI'),     { ssr: false });
const TeamBarChart = dynamic(() => import('../components/charts/TeamBarChart'), { ssr: false });

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────

function fmt(v, d = 1) {
  if (v == null) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

// ساعات → نص مدّة محلي حسب الحجم
function fmtDur(t, hours) {
  if (hours == null || isNaN(Number(hours))) return '—';
  const h = Number(hours);
  if (h === 0)  return t('kpi.duration.instant');
  if (h < 1)    return t('kpi.duration.lessThanHour');
  if (h < 24)   return t('kpi.duration.hours', { n: Math.round(h) });
  const d = h / 24;
  return t('kpi.duration.days', { n: d < 2 ? d.toFixed(1) : Math.round(d) });
}

function fmtRelative(t, locale, v) {
  if (!v) return '-';
  const diffHours = (Date.now() - new Date(v).getTime()) / 3_600_000;
  if (diffHours < 1)   return t('kpi.relative.lessThanHour');
  if (diffHours < 24)  return t('kpi.relative.hoursAgo', { n: Math.round(diffHours) });
  if (diffHours < 168) return t('kpi.relative.daysAgo', { n: Math.floor(diffHours / 24) });
  return new Date(v).toLocaleDateString(locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

// أسماء الأشهر محلية الاتجاه — الفهرس 1..12
function monthName(locale, month, year) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString(locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { month: 'long' });
}

// ─── ثوابت التصميم ────────────────────────────────────────────────────────────

const LEVEL_CFG = {
  OUTSTANDING:       { color: '#253C32', bg: 'bg-forest-50',     border: 'border-primary/30',   text: 'text-primary'   },
  VERY_GOOD:         { color: '#394F49', bg: 'bg-primary-light', border: 'border-primary/20',   text: 'text-primary'   },
  GOOD:              { color: '#4B5952', bg: 'bg-forest-100',    border: 'border-forest-200',   text: 'text-text-main' },
  NEEDS_IMPROVEMENT: { color: '#8B7D6B', bg: 'bg-sand/20',       border: 'border-sand/50',      text: 'text-warning'   },
  WEAK:              { color: '#633646', bg: 'bg-burgundy/10',   border: 'border-burgundy/30',  text: 'text-danger'    },
};

const LEVEL_ORDER = ['OUTSTANDING', 'VERY_GOOD', 'GOOD', 'NEEDS_IMPROVEMENT', 'WEAK'];

// المؤشرات الست — التسميات والتلميحات من الترجمة (kpi.indicators.<key>)
const IND_CFG = [
  { key: 'productivityScore', Icon: Package, weight: 25 },
  { key: 'timelinessScore',   Icon: Clock,   weight: 20 },
  { key: 'qualityScore',      Icon: Star,    weight: 20 },
  { key: 'criticalScore',     Icon: Target,  weight: 20 },
  { key: 'speedScore',        Icon: Zap,     weight: 10 },
  { key: 'disciplineScore',   Icon: Shield,  weight: 5  },
];

const INSIGHT_ICON = { positive: CheckCircle2, warning: AlertTriangle, critical: AlertCircle, info: Info };
const INSIGHT_BG   = {
  positive: 'bg-forest-50 border-accent/20 text-accent',
  warning:  'bg-sand/20 border-sand/40 text-warning',
  critical: 'bg-burgundy/10 border-burgundy/20 text-danger',
  info:     'bg-primary-light border-primary/20 text-primary',
};

function scoreColor(val) {
  if (val >= 80) return { text: 'text-accent',   bar: 'bg-accent',   ring: '#5D8A70' };
  if (val >= 60) return { text: 'text-warning',  bar: 'bg-sand',     ring: '#C3B39F' };
  return             { text: 'text-danger',   bar: 'bg-burgundy', ring: '#633646' };
}

// ─── CircleGauge ─────────────────────────────────────────────────────────────

function CircleGauge({ score, size = 88 }) {
  const s   = Math.min(100, Math.max(0, Number(score) || 0));
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (s / 100) * circ;
  const clr  = scoreColor(s).ring;
  const fs   = size < 64 ? '0.6rem' : size < 80 ? '0.75rem' : '0.9rem';

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D7DBDA" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={clr} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <span className="absolute font-extrabold leading-none" style={{ color: clr, fontSize: fs }}>
        {s > 0 ? `${Math.round(s)}%` : '—'}
      </span>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-border text-text-soft hover:bg-primary/20 hover:text-primary transition"
      >
        <HelpCircle size={11} aria-hidden="true" />
      </button>
      {show && (
        <span className="pointer-events-none absolute bottom-full end-0 z-50 mb-1.5 w-52 rounded-xl border border-border bg-white p-2.5 text-[11px] leading-relaxed text-text-main shadow-soft">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── IndicatorBar ─────────────────────────────────────────────────────────────

function IndicatorBar({ ind, val, showWeight = false, noData = false }) {
  const { t } = useTranslation();
  const v   = Math.min(100, Math.max(0, Number(val) || 0));
  const clr = scoreColor(v);
  const Icon = ind.Icon;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-medium text-text-main">
          <Icon size={14} aria-hidden="true" />
          {t(`kpi.indicators.${ind.key}.label`)}
          {showWeight && <span className="text-[10px] text-text-soft">({ind.weight}%)</span>}
          <Tip text={t(`kpi.indicators.${ind.key}.tip`)} />
        </span>
        <span className={`font-extrabold ${clr.text}`}>{noData ? '—' : `${fmt(v)}%`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-forest-50">
        <div
          className={`h-full rounded-full transition-all duration-700 ${clr.bar}`}
          style={{ width: noData ? '0%' : `${v}%` }}
        />
      </div>
    </div>
  );
}

// ─── LevelBadge ──────────────────────────────────────────────────────────────

function LevelBadge({ level, noData = false, size = 'sm' }) {
  const { t } = useTranslation();
  if (noData) {
    return (
      <span className={`rounded-full border border-border bg-background px-2.5 py-0.5 font-bold text-text-soft ${size === 'lg' ? 'text-sm' : 'text-[10px]'}`}>
        {t('kpi.noDataBadge')}
      </span>
    );
  }
  const cfg = LEVEL_CFG[level] || LEVEL_CFG.GOOD;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-bold ${cfg.bg} ${cfg.border} ${cfg.text} ${size === 'lg' ? 'text-sm' : 'text-[10px]'}`}>
      {t(`performanceLevel.${level}`)}
    </span>
  );
}

// ─── TrendSparkline ───────────────────────────────────────────────────────────

function TrendSparkline({ trend }) {
  const { t } = useTranslation();
  if (!trend?.trend?.length) return null;
  const dir = trend.summary?.direction;
  const DirIcon = dir === 'improving' ? TrendingUp : dir === 'declining' ? TrendingDown : ArrowRight;
  const dirLabel = dir === 'improving' ? t('kpi.trend.improving') : dir === 'declining' ? t('kpi.trend.declining') : t('kpi.trend.stable');
  const dirColor = dir === 'improving' ? 'text-accent' : dir === 'declining' ? 'text-danger' : 'text-text-soft';

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.trend.title')}</h4>
        <span className={`flex items-center gap-1 text-[10px] font-extrabold ${dirColor}`}>
          <DirIcon size={12} aria-hidden="true" /> {dirLabel}
        </span>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto py-1">
        {trend.trend.map((tr, i) => {
          const h   = Math.max(8, Math.round((Number(tr.finalScore) / 100) * 60));
          const val = Number(tr.finalScore) || 0;
          const clr = scoreColor(val).bar;
          const isLast = i === trend.trend.length - 1;
          return (
            <div key={tr.periodLabel} className="flex min-w-[40px] flex-col items-center gap-0.5">
              <span className={`text-[9px] font-bold ${scoreColor(val).text}`}>{Math.round(val)}%</span>
              <div className="w-6 overflow-hidden rounded-t-md" style={{ height: 60, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${clr} ${isLast ? 'opacity-100' : 'opacity-40'}`}
                  style={{ height: h }}
                />
              </div>
              <span className="text-center text-[9px] text-text-soft leading-tight">{tr.periodLabel?.slice(-5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ElementBreakdownTable ────────────────────────────────────────────────────

function ElementBreakdownTable({ breakdown }) {
  const { t } = useTranslation();
  // إصلاح ترتيب الـ hooks: تُستدعى قبل أي return مبكر دائماً
  const [open, setOpen] = useState(false);

  if (!breakdown?.length) return null;

  // هل لدينا بيانات توقيت؟
  const hasTimingData = breakdown.some(el =>
    (el.beforeIdeal || 0) + (el.beforeMax || 0) + (el.afterMax || 0) > 0
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-extrabold text-text-main hover:bg-background transition"
      >
        <span className="flex items-center gap-1.5">
          <ClipboardList size={16} aria-hidden="true" />
          {t('kpi.breakdown.title')} <span className="text-xs font-bold text-text-soft">({t('kpi.breakdown.typesCount', { count: breakdown.length })})</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-text-soft">
          {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {open ? t('kpi.hide') : t('kpi.show')}
        </span>
      </button>
      {open && (
        <div className="border-t border-border">
          {/* أسطورة التوقيت */}
          {hasTimingData && (
            <div className="flex flex-wrap gap-3 px-5 py-2.5 text-[10px] bg-background border-b border-border">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent inline-block" /> {t('kpi.breakdown.legendBeforeIdeal')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> {t('kpi.breakdown.legendBeforeMax')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger inline-block" /> {t('kpi.breakdown.legendAfterMax')}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-background text-text-soft">
                <tr>
                  <th className="px-3 py-2.5 text-start font-bold">{t('kpi.breakdown.colElement')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colRequired')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colApproved')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colReturned')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colApprovalRate')}</th>
                  {hasTimingData && <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colTiming')}</th>}
                  <th className="px-3 py-2.5 text-center font-bold">{t('kpi.breakdown.colAvgSubmission')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {breakdown.map(el => {
                  const rate = Number(el.approvalRate) || 0;
                  const rateColor = rate >= 80 ? 'bg-forest-50 text-accent' : rate >= 60 ? 'bg-sand/20 text-warning' : 'bg-burgundy/10 text-danger';
                  const timedTotal = (el.beforeIdeal||0) + (el.beforeMax||0) + (el.afterMax||0);
                  return (
                    <tr key={el.key} className="hover:bg-background transition">
                      <td className="px-3 py-2 font-bold text-text-main">{el.name}</td>
                      <td className="px-3 py-2 text-center">{el.total ?? '—'}</td>
                      <td className="px-3 py-2 text-center font-bold text-accent">{el.approved ?? '—'}</td>
                      <td className="px-3 py-2 text-center text-warning">{el.returned ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-forest-50">
                            <div className={`h-full rounded-full ${rate>=80?'bg-accent':rate>=60?'bg-sand':'bg-burgundy'}`} style={{width:`${rate}%`}} />
                          </div>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${rateColor}`}>{fmt(rate)}%</span>
                        </div>
                      </td>
                      {hasTimingData && (
                        <td className="px-3 py-2">
                          {timedTotal > 0 ? (
                            <div className="flex items-center gap-1 text-[10px]">
                              {el.beforeIdeal > 0 && (
                                <span className="flex items-center gap-0.5 rounded bg-forest-50 text-accent px-1.5 py-0.5 font-bold">
                                  <Check size={11} aria-hidden="true" /> {el.beforeIdeal}
                                </span>
                              )}
                              {el.beforeMax > 0 && (
                                <span className="flex items-center gap-0.5 rounded bg-primary-light text-primary px-1.5 py-0.5 font-bold">
                                  <Clock size={11} aria-hidden="true" /> {el.beforeMax}
                                </span>
                              )}
                              {el.afterMax > 0 && (
                                <span className="flex items-center gap-0.5 rounded bg-burgundy/10 text-danger px-1.5 py-0.5 font-bold">
                                  <AlertTriangle size={11} aria-hidden="true" /> {el.afterMax}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-text-soft/40">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center text-text-soft">
                        {fmtDur(t, el.avgSubmissionHours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmployeeCard ─────────────────────────────────────────────────────────────

function EmployeeCard({ snap, selected, onSelect }) {
  const { t } = useTranslation();
  const score  = Number(snap.finalScoreDisplay ?? snap.finalScore ?? 0);
  const level  = snap.performanceLevel || 'GOOD';
  const lcfg   = LEVEL_CFG[level] || LEVEL_CFG.GOOD;
  const noData = !snap.isSubjectToEvaluation;
  const name   = `${snap.user?.firstName || ''} ${snap.user?.lastName || ''}`.trim();
  const proj   = snap.user?.operationalProject?.name || '—';
  const ini    = initials(snap.user?.firstName, snap.user?.lastName);

  return (
    <div
      onClick={() => onSelect(snap)}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft
        ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}
    >
      {/* شريط لوني جانبي حسب المستوى */}
      <div
        className="absolute inset-y-0 end-0 w-1 rounded-e-2xl"
        style={{ backgroundColor: noData ? '#D7DBDA' : lcfg.color }}
      />

      <div className="p-4 pe-5">
        {/* الرأس: الصورة + الاسم + المشروع */}
        <div className="mb-3 flex items-start gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
            style={{ backgroundColor: noData ? '#9DA3A1' : lcfg.color }}
          >
            {ini}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-text-main">{name}</p>
            <p className="truncate text-[10px] text-text-soft">{proj}</p>
          </div>
          <LevelBadge level={level} noData={noData} />
        </div>

        {/* القياس الدائري + الأشرطة */}
        <div className="flex items-center gap-3 mb-3">
          <CircleGauge score={noData ? 0 : score} size={76} />
          <div className="flex-1 min-w-0 space-y-1.5">
            {IND_CFG.slice(0, 3).map(ind => {
              const v = Math.min(100, Math.max(0, Number(snap[ind.key]) || 0));
              const Icon = ind.Icon;
              return (
                <div key={ind.key}>
                  <div className="mb-0.5 flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-text-soft"><Icon size={12} aria-hidden="true" /> {t(`kpi.indicators.${ind.key}.label`)}</span>
                    <span className={`font-bold ${scoreColor(v).text}`}>{noData ? '—' : `${Math.round(v)}%`}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-forest-50">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${scoreColor(v).bar}`}
                      style={{ width: noData ? '0%' : `${v}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* الشارات السفلية */}
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {t('kpi.coursesCount', { count: snap.actualCoursesCount ?? 0 })}
          </span>
          {snap.overdueElementsCount > 0 && (
            <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[10px] font-bold text-danger">
              {t('kpi.overdueCount', { count: snap.overdueElementsCount })}
            </span>
          )}
          <span className={`flex items-center gap-1 text-[10px] font-bold transition ${selected ? 'text-primary' : 'text-text-soft group-hover:text-primary'}`}>
            {selected ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            {selected ? t('kpi.collapse') : t('common.details')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── DetailsPanel ─────────────────────────────────────────────────────────────

function DetailsPanel({ snap, isManager, onClose, onNoteAdded }) {
  const { t, locale } = useTranslation();
  const [note,         setNote]         = useState('');
  const [savingNote,   setSavingNote]   = useState(false);
  const [trend,        setTrend]        = useState(null);

  const score = Number(snap.finalScoreDisplay ?? snap.finalScore ?? 0);
  const level = snap.performanceLevel || 'GOOD';
  const name  = `${snap.user?.firstName || ''} ${snap.user?.lastName || ''}`.trim();

  useEffect(() => {
    if (!snap?.userId) return;
    api.get(`/kpis/trend/${snap.userId}`, { params: { periodType: snap.periodType, periodsCount: 6 } })
      .then(r => setTrend(r.data))
      .catch(() => {});
  }, [snap?.userId, snap?.periodType]);

  const handleNote = async () => {
    if (!note.trim()) { toast.error(t('kpi.noteEmpty')); return; }
    setSavingNote(true);
    try {
      await api.post(`/kpis/${snap.userId}/${snap.periodType}/${snap.periodLabel}/notes`, { note: note.trim() });
      toast.success(t('kpi.noteSaved'));
      setNote('');
      onNoteAdded?.();
    } catch (e) {
      toast.error(e.response?.data?.message || t('kpi.saveFailed'));
    } finally {
      setSavingNote(false);
    }
  };

  const radarData = useMemo(
    () => IND_CFG.map(ind => ({
      subject:  t(`kpi.indicators.${ind.key}.label`),
      score:    Math.min(100, Number(snap[ind.key]) || 0),
      fullMark: 100,
    })),
    [snap, t],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-soft">
      {/* رأس اللوح */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-l from-primary/5 to-white px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <CircleGauge score={score} size={56} />
          <div className="min-w-0">
            <h3 className="font-extrabold text-text-main">{name}</h3>
            <p className="text-xs text-text-soft truncate">{snap.user?.operationalProject?.name} — {snap.periodLabel}</p>
          </div>
          <LevelBadge level={level} size="lg" />
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-text-soft hover:bg-background hover:text-primary transition"
        >
          <X size={14} aria-hidden="true" /> {t('common.close')}
        </button>
      </div>

      <div className="space-y-5 p-5">

        {/* بطاقات الملخص السريع */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('kpi.summary.totalScore'),       val: `${fmt(score)}%`,                         color: scoreColor(score).text },
            { label: t('kpi.summary.elementCompletion'), val: `${fmt(snap.closureCompletionRate)}%`,    color: 'text-primary' },
            { label: t('kpi.summary.actualCourses'),    val: snap.actualCoursesCount ?? 0,             color: 'text-text-main' },
            { label: t('kpi.summary.overdueElements'),  val: snap.overdueElementsCount ?? 0,           color: (snap.overdueElementsCount > 0) ? 'text-danger' : 'text-accent' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="mb-0.5 text-[10px] text-text-soft">{c.label}</p>
              <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* الرادار + أشرطة المؤشرات */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.radarTitle')}</h4>
            <RadarKPI data={radarData} />
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.sixIndicatorsDetail')}</h4>
            <div className="space-y-2.5">
              {IND_CFG.map(ind => (
                <IndicatorBar key={ind.key} ind={ind} val={snap[ind.key]} showWeight />
              ))}
            </div>
          </div>
        </div>

        {/* الاتجاه الزمني */}
        {trend && <TrendSparkline trend={trend} />}

        {/* الرؤى التلقائية */}
        {snap.insights?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.autoInsights')}</h4>
            <div className="space-y-1.5">
              {snap.insights.map((ins, i) => {
                const InsIcon = INSIGHT_ICON[ins.type] || Info;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed ${INSIGHT_BG[ins.type] || INSIGHT_BG.info}`}
                  >
                    <span className="shrink-0 mt-px"><InsIcon size={14} aria-hidden="true" /></span>
                    <span>{ins.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* تفصيل العناصر */}
        {snap.elementBreakdown?.length > 0 && (
          <ElementBreakdownTable breakdown={snap.elementBreakdown} />
        )}

        {/* الملاحظات السابقة */}
        {snap.notes?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.previousNotes')}</h4>
            {snap.notes.map((n, i) => (
              <div key={n.id || i} className="rounded-xl border border-primary/10 bg-primary-light/30 px-3.5 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-primary">{n.manager?.firstName} {n.manager?.lastName}</span>
                  <span className="text-[10px] text-text-soft">{fmtRelative(t, locale, n.createdAt)}</span>
                </div>
                <p className="text-xs text-text-main leading-relaxed">{n.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* إضافة ملاحظة جديدة — مدير فقط */}
        {isManager && (
          <div className="rounded-xl border border-primary/20 bg-primary-light/20 p-3.5">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-primary">
              <Pencil size={14} aria-hidden="true" /> {t('kpi.addNote')}
            </h4>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder={t('kpi.notePlaceholder')}
              className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-xs text-text-main outline-none focus:border-primary transition"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleNote}
                disabled={savingNote || !note.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {savingNote ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> {t('common.saving')}</> : t('kpi.saveNote')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EmployeePersonalView ─────────────────────────────────────────────────────

function EmployeePersonalView({ snap, month, year }) {
  const { t, locale } = useTranslation();
  const [detail,        setDetail]        = useState(null);
  const [trend,         setTrend]         = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!snap?.userId) return;
    setLoadingDetail(true);
    api.get(`/kpis/${snap.userId}/${snap.periodType}/${snap.periodLabel}`)
      .then(r => setDetail(r.data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
    api.get(`/kpis/trend/${snap.userId}`, { params: { periodType: snap.periodType, periodsCount: 6 } })
      .then(r => setTrend(r.data))
      .catch(() => {});
  }, [snap?.userId, snap?.periodType, snap?.periodLabel]);

  const s     = detail || snap || {};
  const score = Number(s.finalScoreDisplay ?? s.finalScore ?? 0);
  const level = s.performanceLevel || 'NEEDS_IMPROVEMENT';
  const noData = !s.isSubjectToEvaluation;

  const radarData = useMemo(
    () => IND_CFG.map(ind => ({
      subject:  t(`kpi.indicators.${ind.key}.label`),
      score:    Math.min(100, Number(s[ind.key]) || 0),
      fullMark: 100,
    })),
    [s, t],
  );

  if (!snap) return null;

  if (loadingDetail) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-text-soft">{t('kpi.loadingYourKpis')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* بطاقة النتيجة البطولية */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-card">
        {/* الهيدر الملوّن */}
        <div className="relative bg-gradient-to-l from-primary/8 via-white to-forest-50/60 px-5 py-6">
          <div className="flex flex-wrap items-center gap-5">
            <CircleGauge score={noData ? 0 : score} size={100} />
            <div className="flex-1 min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-text-main">
                  {s.user?.firstName} {s.user?.lastName}
                </h2>
                <LevelBadge level={level} noData={noData} size="lg" />
              </div>
              <p className="mb-3 text-xs text-text-soft">
                {s.user?.operationalProject?.name || t('kpi.noProject')} · {monthName(locale, month, year)} {year}
              </p>
              {!noData && (
                <p className="text-sm leading-relaxed text-text-main max-w-lg">
                  {t(`kpi.encourage.${level}`)}
                </p>
              )}
              {noData && (
                <p className="text-sm text-warning">
                  {t('kpi.noCoursesInPeriod')}
                </p>
              )}
            </div>
          </div>

          {/* إحصائيات سريعة */}
          {!noData && (
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: t('kpi.summary.totalScore'),       val: `${fmt(score)}%`,                        color: scoreColor(score).text },
                { label: t('kpi.summary.closureCompletion'), val: `${fmt(s.closureCompletionRate)}%`,     color: 'text-primary' },
                { label: t('kpi.summary.courses'),          val: `${s.actualCoursesCount ?? 0}`,          color: 'text-text-main' },
                { label: t('kpi.summary.overdueElements'),  val: `${s.overdueElementsCount ?? 0}`,        color: s.overdueElementsCount > 0 ? 'text-danger' : 'text-accent' },
              ].map(c => (
                <div key={c.label} className="rounded-xl border border-border bg-white/80 px-4 py-2 text-center min-w-[80px]">
                  <p className="text-[10px] text-text-soft">{c.label}</p>
                  <p className={`text-lg font-extrabold ${c.color}`}>{c.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* المؤشرات الست */}
        {!noData && (
          <div className="border-t border-border px-5 py-5">
            <h3 className="mb-4 text-xs font-extrabold uppercase tracking-wide text-text-soft">
              {t('kpi.sixIndicatorsThisMonth')}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {IND_CFG.map(ind => (
                <IndicatorBar key={ind.key} ind={ind} val={s[ind.key]} showWeight noData={noData} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* الرادار + الرؤى */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!noData && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.radarTitle')}</h4>
            <RadarKPI data={radarData} />
          </div>
        )}

        {s.insights?.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.guidanceAndNotes')}</h4>
            <div className="space-y-2">
              {s.insights.map((ins, i) => {
                const InsIcon = INSIGHT_ICON[ins.type] || Info;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${INSIGHT_BG[ins.type] || INSIGHT_BG.info}`}
                  >
                    <span className="shrink-0 mt-px"><InsIcon size={14} aria-hidden="true" /></span>
                    <span>{ins.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* مسار الأداء */}
      {trend?.trend?.length > 1 && (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <TrendSparkline trend={trend} />
        </div>
      )}

      {/* تفصيل العناصر */}
      {s.elementBreakdown?.length > 0 && (
        <ElementBreakdownTable breakdown={s.elementBreakdown} />
      )}

      {/* ملاحظات الإدارة */}
      {s.notes?.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-text-soft">{t('kpi.managementNotes')}</h4>
          <div className="space-y-2">
            {s.notes.map((n, i) => (
              <div key={n.id || i} className="rounded-xl border border-primary/10 bg-primary-light/30 px-3.5 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-primary">{n.manager?.firstName} {n.manager?.lastName}</span>
                  <span className="text-[10px] text-text-soft">
                    {new Date(n.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-text-main">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatsPill ────────────────────────────────────────────────────────────────

function StatsPill({ label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:shadow-sm
        ${active ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-main hover:border-primary/30 hover:bg-background'}`}
    >
      <span>{value}</span>
      <span className={active ? 'text-white/80' : 'text-text-soft'}>{label}</span>
    </button>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────

export default function KpisPage() {
  const { t, locale } = useTranslation();
  const { activeRole, user } = useAuth();
  const isManager    = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isEmployee   = activeRole === 'EMPLOYEE';

  const OFFICIAL_START = '2026-06'; // البداية الرسمية للاحتساب

  const now = new Date();
  const [periodMode, setPeriodMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLB, setLoadingLB] = useState(false);

  const periodLabel = useMemo(() =>
    periodMode === 'yearly'
      ? String(year)
      : `${year}-${String(month).padStart(2, '0')}`,
    [year, month, periodMode],
  );

  const [snapshots,    setSnapshots]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [calculating,  setCalculating]  = useState(false);
  const [selectedId,   setSelectedId]   = useState(null);
  const [selectedSnap, setSelectedSnap] = useState(null);
  const [loadingDet,   setLoadingDet]   = useState(false);
  const [lastCalc,     setLastCalc]     = useState(null);
  const [levelFilter,  setLevelFilter]  = useState(null);

  // ── جلب اللقطات ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pt  = periodMode === 'yearly' ? 'YEARLY' : 'MONTHLY';
      const res = await api.get('/kpis', { params: { periodType: pt, periodLabel } });
      const data = res.data || [];
      setSnapshots(data);
      if (data.length) setLastCalc(data[0]?.updatedAt || data[0]?.createdAt);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [periodLabel, periodMode]);

  // ── لوحة المشاريع ──
  const loadLeaderboard = useCallback(() => {
    if (!isManager && !isSupervisor) return;
    setLoadingLB(true);
    api.get('/kpis/leaderboard', { params: { periodLabel: periodMode === 'monthly' ? periodLabel : undefined } })
      .then(r => setLeaderboard(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoadingLB(false));
  }, [periodLabel, periodMode, isManager, isSupervisor]);

  useEffect(() => {
    load();
    setSelectedId(null);
    setSelectedSnap(null);
    setLevelFilter(null);
  }, [load]);

  useEffect(() => {
    if (showLeaderboard) loadLeaderboard();
  }, [showLeaderboard, loadLeaderboard]);

  // ── احتساب المؤشرات ──
  const calculate = async () => {
    if (!isManager) return;
    setCalculating(true);
    try {
      if (periodMode === 'yearly') {
        await api.post('/kpis/calculate-yearly', { year });
        toast.success(t('kpi.calcYearlySuccess'));
        load();
        return;
      }
      await api.post('/kpis/calculate', { periodType: 'MONTHLY', year, value: month });
      toast.success(t('kpi.calcSuccess'));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || t('kpi.calcFailed'));
    } finally {
      setCalculating(false);
    }
  };

  // ── فتح/إغلاق تفاصيل موظف ──
  const openDetails = async (snap) => {
    if (selectedId === snap.userId) {
      setSelectedId(null);
      setSelectedSnap(null);
      return;
    }
    setSelectedId(snap.userId);
    setLoadingDet(true);
    try {
      const res = await api.get(`/kpis/${snap.userId}/${snap.periodType}/${snap.periodLabel}`);
      setSelectedSnap(res.data);
    } catch {
      toast.error(t('kpi.loadEmployeeFailed'));
      setSelectedId(null);
    } finally {
      setLoadingDet(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedSnap) return;
    const res = await api.get(`/kpis/${selectedSnap.userId}/${selectedSnap.periodType}/${selectedSnap.periodLabel}`).catch(() => null);
    if (res) setSelectedSnap(res.data);
    await load();
  };

  // ── تنقل الأشهر/السنوات ──
  const prevMonth = () => {
    if (periodMode === 'yearly') { setYear(y => y - 1); return; }
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (periodMode === 'yearly') {
      if (year < now.getFullYear()) setYear(y => y + 1);
      return;
    }
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return;
    if (month === 12) setYear(y => y + 1);
    setMonth(nm);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // ── إحصائيات ──
  const activeSnaps   = useMemo(() => snapshots.filter(x => x.isSubjectToEvaluation),  [snapshots]);
  const inactiveSnaps = useMemo(() => snapshots.filter(x => !x.isSubjectToEvaluation), [snapshots]);

  const stats = useMemo(() => {
    const counts = {};
    for (const key of Object.keys(LEVEL_CFG)) {
      counts[key] = activeSnaps.filter(x => x.performanceLevel === key).length;
    }
    const avg = activeSnaps.length
      ? activeSnaps.reduce((a, x) => a + Number(x.finalScoreDisplay ?? x.finalScore ?? 0), 0) / activeSnaps.length
      : 0;
    return { counts, avg, total: activeSnaps.length, noData: inactiveSnaps.length };
  }, [activeSnaps, inactiveSnaps]);

  const filteredSnaps = useMemo(() => {
    if (levelFilter) return activeSnaps.filter(x => x.performanceLevel === levelFilter);
    return [...activeSnaps, ...inactiveSnaps];
  }, [activeSnaps, inactiveSnaps, levelFilter]);

  const teamBarData = useMemo(
    () => activeSnaps
      .filter(s => s.finalScoreDisplay != null || s.finalScore != null)
      .map(s => ({
        name:  `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim(),
        score: Number(s.finalScoreDisplay ?? s.finalScore ?? 0),
      })),
    [activeSnaps],
  );

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="space-y-5">

        {/* ══════ رأس الصفحة ══════ */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">

          {/* السطر الرئيسي */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-extrabold text-primary">
                <BarChart3 size={20} aria-hidden="true" /> {t('kpi.title')}
              </h1>
              <p className="mt-0.5 text-xs text-text-soft">
                {isEmployee ? t('kpi.subtitleEmployee') : t('kpi.subtitleTeam')}
              </p>
            </div>

            {/* تبويب شهري / سنوي */}
            <div className="flex overflow-hidden rounded-xl border border-border text-xs font-bold">
              {['monthly','yearly'].map(m => (
                <button key={m} onClick={() => { setPeriodMode(m); setSelectedId(null); setSelectedSnap(null); }}
                  className={`px-4 py-2 transition ${periodMode===m ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>
                  {m === 'monthly' ? t('kpi.monthly') : t('kpi.yearly')}
                </button>
              ))}
            </div>

            {/* تنقل الأشهر */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                aria-label={t('common.previous')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-soft hover:bg-background hover:text-primary transition"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <div className="min-w-[130px] text-center">
                {periodMode === 'monthly' ? (
                  <>
                    <p className="font-extrabold text-primary">{monthName(locale, month, year)} {year}</p>
                    {isCurrentMonth && <p className="text-[10px] text-accent">● {t('kpi.currentMonth')}</p>}
                    {periodLabel < OFFICIAL_START && (
                      <p className="text-[10px] text-warning">{t('kpi.trial')}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-extrabold text-primary">{t('kpi.yearLabel', { year })}</p>
                    <p className="text-[10px] text-text-soft">{t('kpi.janToDec')}</p>
                  </>
                )}
              </div>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth && periodMode === 'monthly'}
                aria-label={t('common.next')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-soft hover:bg-background hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 transition"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            </div>

            {/* أزرار الأكشن */}
            <div className="flex flex-wrap items-center gap-2">
              {lastCalc && !isEmployee && (
                <span className="text-[10px] text-text-soft">{t('kpi.lastCalc')}: {fmtRelative(t, locale, lastCalc)}</span>
              )}
              {isEmployee && lastCalc && (
                <span className="flex items-center gap-1 rounded-xl border border-accent/20 bg-forest-50 px-3 py-1.5 text-[11px] font-bold text-accent">
                  <CheckCircle2 size={13} aria-hidden="true" /> {t('kpi.kpisUpdated', { time: fmtRelative(t, locale, lastCalc) })}
                </span>
              )}
              {isManager && (
                <button
                  onClick={calculate}
                  disabled={calculating}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60 transition shadow-sm"
                >
                  {calculating ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t('kpi.calculating')}
                    </>
                  ) : (
                    <><Settings size={15} aria-hidden="true" /> {t('kpi.calculateKpis')}</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* شريط الإحصائيات والفلتر — مدير/مشرف */}
          {!loading && snapshots.length > 0 && !isEmployee && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
              {/* متوسط الفريق */}
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-light px-4 py-1.5">
                <span className="text-base font-extrabold text-primary">{fmt(stats.avg)}%</span>
                <span className="text-xs text-text-soft">{t('kpi.teamAverage')}</span>
                <span className="text-[10px] text-text-soft">({t('kpi.employeesCount', { count: stats.total })})</span>
              </div>

              <div className="h-5 w-px bg-border" />

              {/* أزرار فلتر المستويات */}
              {LEVEL_ORDER.map(key => stats.counts[key] > 0 && (
                <StatsPill
                  key={key}
                  label={t(`performanceLevel.${key}`)}
                  value={stats.counts[key]}
                  active={levelFilter === key}
                  onClick={() => setLevelFilter(v => v === key ? null : key)}
                />
              ))}

              {levelFilter && (
                <button
                  onClick={() => setLevelFilter(null)}
                  className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-[10px] text-text-soft hover:text-danger transition"
                >
                  <X size={12} aria-hidden="true" /> {t('kpi.clearFilter')}
                </button>
              )}

              {stats.noData > 0 && (
                <div className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-text-soft">
                  {t('kpi.noDataCount', { count: stats.noData })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════ حالة التحميل ══════ */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-text-soft">{t('kpi.loadingMonth', { month: monthName(locale, month, year) })}</span>
            </div>
          </div>
        )}

        {/* ══════ حالة فارغة ══════ */}
        {!loading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center shadow-card">
            <div className="mb-4 text-primary/40"><BarChart3 size={56} aria-hidden="true" /></div>
            <h3 className="mb-1 text-lg font-extrabold text-text-main">
              {t('kpi.emptyTitle', { month: monthName(locale, month, year), year })}
            </h3>
            <p className="mb-5 max-w-md text-sm text-text-soft">
              {isManager
                ? t('kpi.emptyManager')
                : isEmployee
                ? t('kpi.emptyEmployee')
                : t('kpi.emptySupervisor')}
            </p>
            {isManager && (
              <button
                onClick={calculate}
                disabled={calculating}
                className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 font-bold text-white hover:bg-primary/90 disabled:opacity-60 transition"
              >
                {calculating ? t('kpi.calculatingNow') : <><Settings size={16} aria-hidden="true" /> {t('kpi.calculateNow')}</>}
              </button>
            )}
          </div>
        )}

        {/* ══════ لوحة الموظف الشخصية ══════ */}
        {!loading && isEmployee && snapshots.length > 0 && (
          <EmployeePersonalView snap={snapshots[0]} month={month} year={year} />
        )}

        {/* ══════ لوحة ترتيب المشاريع — مدير/مشرف ══════ */}
        {!loading && (isManager || isSupervisor) && periodMode === 'monthly' && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <button onClick={() => setShowLeaderboard(v=>!v)}
              className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition">
              <div>
                <h3 className="flex items-center gap-2 font-extrabold text-text-main">
                  <Trophy size={18} aria-hidden="true" /> {t('kpi.leaderboard.title', { month: monthName(locale, month, year), year })}
                </h3>
                <p className="text-[11px] text-text-soft mt-0.5">{t('kpi.leaderboard.subtitle')}</p>
              </div>
              <span className="text-xs text-text-soft">{showLeaderboard ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}</span>
            </button>
            {showLeaderboard && (
              <div className="border-t border-border">
                {loadingLB ? (
                  <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
                ) : leaderboard.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-soft">{t('kpi.noPeriodData')}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {leaderboard.map((proj, idx) => (
                      <div key={proj.projectId} className="flex items-center gap-4 px-5 py-3.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white
                          ${idx===0?'bg-primary':idx===1?'bg-accent':idx===2?'bg-sand':'bg-text-soft/40'}`}>
                          {idx+1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-sm text-text-main">{proj.projectName}</p>
                          <p className="text-[11px] text-text-soft">
                            {t('kpi.leaderboard.evaluatedEmployees', { count: proj.employeesCount })}
                            {proj.topEmployee && ` · ${t('kpi.leaderboard.top', { name: proj.topEmployee.name })}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24 h-1.5 overflow-hidden rounded-full bg-forest-50">
                            <div className="h-full rounded-full bg-primary transition-all"
                              style={{width:`${Math.min(100,proj.avgScore)}%`}} />
                          </div>
                          <span className="text-sm font-extrabold text-primary w-12 text-end">
                            {Number(proj.avgScore).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ مقارنة الفريق — مدير/مشرف ══════ */}
        {!loading && teamBarData.length > 1 && !isEmployee && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="flex items-center gap-2 font-extrabold text-text-main">
                <TrendingUp size={18} aria-hidden="true" /> {t('kpi.teamComparison.title')}
              </h3>
              <p className="text-xs text-text-soft">{t('kpi.teamComparison.legend')}</p>
            </div>
            <div className="p-4">
              <TeamBarChart data={teamBarData} />
            </div>
          </div>
        )}

        {/* ══════ شبكة بطاقات الموظفين النشطين ══════ */}
        {!loading && filteredSnaps.length > 0 && !isEmployee && (
          <>
            {levelFilter && (
              <p className="text-xs text-text-soft px-1">
                {t('kpi.showingCount', { count: filteredSnaps.length })} — {t('kpi.levelLabel')}: <strong>{t(`performanceLevel.${levelFilter}`)}</strong>
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredSnaps.map(snap => {
                const isSelected = selectedId === snap.userId;
                return (
                  <div key={snap.userId}>
                    <EmployeeCard snap={snap} selected={isSelected} onSelect={openDetails} />

                    {/* التفاصيل مباشرة تحت البطاقة — موبايل */}
                    {isSelected && loadingDet && (
                      <div className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-border bg-white p-6 sm:hidden">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs text-text-soft">{t('common.loading')}</span>
                      </div>
                    )}
                    {isSelected && selectedSnap && !loadingDet && (
                      <div className="mt-2 sm:hidden">
                        <DetailsPanel
                          snap={selectedSnap}
                          isManager={isManager}
                          onClose={() => { setSelectedId(null); setSelectedSnap(null); }}
                          onNoteAdded={refreshDetail}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══════ لوح التفاصيل — شاشات كبيرة ══════ */}
        {!loading && !isEmployee && (loadingDet || selectedSnap) && (
          <div className="hidden sm:block">
            {loadingDet ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-12 shadow-card text-text-soft">
                <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
                <span className="text-sm">{t('kpi.loadingDetails')}</span>
              </div>
            ) : selectedSnap ? (
              <DetailsPanel
                snap={selectedSnap}
                isManager={isManager}
                onClose={() => { setSelectedId(null); setSelectedSnap(null); }}
                onNoteAdded={refreshDetail}
              />
            ) : null}
          </div>
        )}

        {/* ══════ تقرير المشرفين + سجل الإسناد — مدير فقط ══════ */}
        {isManager && <SupervisorReport periodLabel={periodLabel} />}
        {isManager && <AssignmentSection periodLabel={periodLabel} year={year} month={month} />}

      </div>
    </MainLayout>
  );
}

// ─── تقرير أداء المشرفين ─────────────────────────────────────────────────────

function SupervisorReport({ periodLabel }) {
  const { t } = useTranslation();
  const [data,    setData]    = useState([]);
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/supervisor-performance', { params: { periodType: 'MONTHLY', periodLabel } })
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  // مفاتيح الاستجابة (القيم تأتي بالعربية من الـ API) → ألوان + تسمية محلية
  const RESP_CFG = {
    'سريع جداً': { color: 'text-accent bg-forest-50 border-forest-200',     key: 'veryFast' },
    'مقبول':     { color: 'text-primary bg-primary-light border-primary/20', key: 'acceptable' },
    'بطيء':      { color: 'text-warning bg-sand/20 border-sand/50',          key: 'slow' },
    'متأخر':     { color: 'text-danger bg-burgundy/10 border-burgundy/30',   key: 'late' },
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-forest-200 bg-white shadow-card">
      <button
        onClick={() => setShow(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition"
      >
        <div className="flex items-center gap-2.5">
          <Crown size={18} aria-hidden="true" className="text-primary" />
          <div className="text-start">
            <h4 className="text-sm font-extrabold text-text-main">{t('kpi.supervisorReport.title')}</h4>
            <p className="text-[10px] text-text-soft">{t('kpi.supervisorReport.subtitle')}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-text-soft">
          {show ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {show ? t('kpi.hide') : t('kpi.show')}
        </span>
      </button>

      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-soft">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('common.loading')}
            </div>
          ) : !data.length ? (
            <div className="py-10 text-center text-sm text-text-soft">{t('kpi.supervisorReport.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['supervisor','totalDecisions','approved','returned','rejected','approvalRate','avgDecisionTime','rating'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-start font-bold">{t(`kpi.supervisorReport.col.${h}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(s => {
                    const respCfg = RESP_CFG[s.responsiveness];
                    return (
                      <tr key={s.userId} className="hover:bg-background transition">
                        <td className="px-3 py-2.5 font-bold text-text-main">{s.name}</td>
                        <td className="px-3 py-2.5 text-center font-extrabold text-primary">{s.totalDecisions}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-accent">{s.approved}</td>
                        <td className="px-3 py-2.5 text-center text-warning">{s.returned}</td>
                        <td className="px-3 py-2.5 text-center text-danger">{s.rejected}</td>
                        <td className="px-3 py-2.5">
                          <div className="mb-0.5 h-1.5 w-full overflow-hidden rounded-full bg-forest-100">
                            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${s.approvalRate}%` }} />
                          </div>
                          <span className="text-[10px] font-bold">{s.approvalRate}%</span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-text-main">
                          {s.avgResponseHours != null ? fmtDur(t, s.avgResponseHours) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${respCfg?.color || 'bg-background text-text-soft border-border'}`}>
                            {respCfg ? t(`kpi.responsiveness.${respCfg.key}`) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── سجل الإسناد التخطيطي ────────────────────────────────────────────────────

function AssignmentSection({ periodLabel, year, month }) {
  const { t } = useTranslation();
  const [show,    setShow]    = useState(false);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState({});

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/assignments', { params: { periodType: 'MONTHLY', year: Number(year), value: Number(month) } })
      .then(r => setRows(
        (r.data?.rows || []).map(row => ({
          ...row,
          inp: row.assignedCoursesCount == null ? '' : String(row.assignedCoursesCount),
          ni:  row.notes || '',
        })),
      ))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  const upd = (uid, field, val) =>
    setRows(prev => prev.map(r => r.userId === uid ? { ...r, [field]: val } : r));

  const save = async (row) => {
    const count = Number(String(row.inp).trim());
    if (isNaN(count) || count < 0) { toast.error(t('kpi.assignment.invalidCount')); return; }
    setSaving(p => ({ ...p, [row.userId]: true }));
    try {
      await api.post('/kpis/assignments', {
        userId:               row.userId,
        periodType:           'MONTHLY',
        year:                 Number(year),
        value:                Number(month),
        assignedCoursesCount: count,
        notes:                row.ni || '',
      });
      toast.success(t('kpi.saved'));
    } catch {
      toast.error(t('kpi.saveFailed'));
    } finally {
      setSaving(p => ({ ...p, [row.userId]: false }));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <button
        onClick={() => setShow(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList size={18} aria-hidden="true" className="text-primary" />
          <div className="text-start">
            <h4 className="text-sm font-extrabold text-text-main">{t('kpi.assignment.title')}</h4>
            <p className="text-[10px] text-text-soft">{t('kpi.assignment.subtitle')}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-text-soft">
          {show ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {show ? t('kpi.hide') : t('kpi.show')}
        </span>
      </button>

      {!show && (
        <div className="flex items-center gap-1.5 border-t border-border bg-sand/10 px-5 py-2 text-[10px] text-warning">
          <Lightbulb size={12} aria-hidden="true" /> {t('kpi.assignment.hint')}
        </div>
      )}

      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-soft">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('common.loading')}
            </div>
          ) : !rows.length ? (
            <div className="py-8 text-center text-sm text-text-soft">{t('kpi.assignment.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['employee','actual','planned','coverage','note','action'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-start font-bold">{h === 'action' ? '' : t(`kpi.assignment.col.${h}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.userId} className="hover:bg-background transition">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-text-main">{row.employeeName}</p>
                        <p className="text-[10px] text-text-soft">{row.projectName}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-primary">{row.actualCoursesCount}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          value={row.inp}
                          onChange={e => upd(row.userId, 'inp', e.target.value)}
                          className="w-16 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary transition"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${Number(row.courseRegistrationCoverageRate) >= 100 ? 'text-accent' : 'text-warning'}`}>
                          {Number(row.courseRegistrationCoverageRate).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          value={row.ni}
                          onChange={e => upd(row.userId, 'ni', e.target.value)}
                          className="w-36 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary transition"
                          placeholder={t('kpi.assignment.notePlaceholder')}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => save(row)}
                          disabled={!!saving[row.userId]}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition"
                        >
                          {saving[row.userId] ? '...' : t('common.save')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
