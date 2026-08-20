
import dynamic from 'next/dynamic';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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

// ─── ThCol — عنوان عمود مع tooltip ──────────────────────────────────────────

function ThCol({ children, tip, center = true }) {
  const [show, setShow] = useState(false);
  return (
    <th className={`px-3 py-2.5 font-bold text-text-soft ${center ? 'text-center' : 'text-right'}`}>
      <span className="relative inline-flex items-center gap-1">
        {children}
        {tip && (
          <span className="relative inline-flex"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}>
            <span className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-border text-[9px] font-bold text-text-soft hover:bg-primary/20 hover:text-primary transition">?</span>
            {show && (
              <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-1.5 w-56 rounded-xl border border-border bg-white p-2.5 text-[11px] font-normal leading-relaxed text-text-main shadow-lg text-right">
                {tip}
              </span>
            )}
          </span>
        )}
      </span>
    </th>
  );
}

// ─── TimingBadge — شارة توقيت مع tooltip ─────────────────────────────────────

function TimingBadge({ icon, count, color, tip }) {
  const [show, setShow] = useState(false);
  if (!count) return null;
  return (
    <span className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      <span className={`cursor-help rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
        {icon} {count}
      </span>
      {show && (
        <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-1.5 w-52 rounded-xl border border-border bg-white p-2.5 text-[11px] leading-relaxed text-text-main shadow-lg text-right">
          {tip}
          <br />
          <span className="font-extrabold text-primary">{count} عنصر</span> في هذه الفئة
        </span>
      )}
    </span>
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

  const totals = breakdown.reduce((acc, el) => ({
    total:    (acc.total    || 0) + (el.total    || 0),
    approved: (acc.approved || 0) + (el.approved || 0),
    returned: (acc.returned || 0) + (el.returned || 0),
    beforeIdeal: (acc.beforeIdeal || 0) + (el.beforeIdeal || 0),
    beforeMax:   (acc.beforeMax   || 0) + (el.beforeMax   || 0),
    afterMax:    (acc.afterMax    || 0) + (el.afterMax    || 0),
  }), {});

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-extrabold text-text-main">
            📋 تفصيل الأداء حسب نوع العنصر
            <span className="mr-1.5 text-xs font-bold text-text-soft">({breakdown.length} نوع)</span>
          </span>
          {/* ملخص سريع */}
          <div className="hidden sm:flex items-center gap-2 text-[10px]">
            <span className="rounded-lg bg-forest-50 px-2 py-0.5 font-bold text-accent">✓ {totals.approved} مقبول</span>
            {totals.returned > 0 && <span className="rounded-lg bg-sand/20 px-2 py-0.5 font-bold text-warning">↩ {totals.returned} أُعيد</span>}
            {totals.afterMax > 0 && <span className="rounded-lg bg-burgundy/10 px-2 py-0.5 font-bold text-danger">⚠ {totals.afterMax} متأخر</span>}
          </div>
        </div>
        <span className="text-xs text-text-soft">{open ? '▲ إخفاء' : '▼ إظهار'}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {/* شرح التوقيت */}
          {hasTimingData && (
            <div className="flex flex-wrap items-center gap-4 bg-background/60 px-5 py-2.5 border-b border-border">
              <span className="text-[10px] font-extrabold text-text-soft">دليل التوقيت:</span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <span className="rounded bg-forest-50 px-1.5 py-0.5 font-bold text-accent">✓</span>
                <span className="text-text-soft">قبل الموعد المثالي — ممتاز</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <span className="rounded bg-primary-light px-1.5 py-0.5 font-bold text-primary">⏱</span>
                <span className="text-text-soft">بعد المثالي وقبل الأقصى — مقبول</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <span className="rounded bg-burgundy/10 px-1.5 py-0.5 font-bold text-danger">⚠</span>
                <span className="text-text-soft">بعد الموعد الأقصى — متأخر</span>
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-background/40">
                <tr>
                  <ThCol center={false}>نوع العنصر</ThCol>
                  <ThCol tip="العدد الإجمالي للعناصر المطلوب تقديمها من هذا النوع خلال الفترة">المطلوب</ThCol>
                  <ThCol tip="عدد العناصر التي اعتمدها المشرف بشكل نهائي">✅ قُبل</ThCol>
                  <ThCol tip="عدد العناصر التي أعادها المشرف للمراجعة والتعديل — كلما قلّت كان أفضل">↩ أُعيد</ThCol>
                  <ThCol tip="نسبة العناصر المقبولة من أول تقديم دون إعادة — تؤثر مباشرة على مؤشر الجودة">معدل القبول</ThCol>
                  {hasTimingData && (
                    <ThCol tip="توزيع مواعيد التقديم: ✓ قبل المثالي (أفضل) · ⏱ بعد المثالي وقبل الأقصى (مقبول) · ⚠ بعد الأقصى (يؤثر سلباً على مؤشر التوقيت)">
                      توزيع التوقيت ℹ️
                    </ThCol>
                  )}
                  <ThCol tip="متوسط الوقت من تاريخ المرجع (بداية/نهاية الدورة) حتى تاريخ التقديم الفعلي">متوسط التقديم</ThCol>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {breakdown.map(el => {
                  const rate = Number(el.approvalRate) || 0;
                  const rateColor = rate >= 80 ? 'bg-forest-50 text-accent' : rate >= 60 ? 'bg-sand/20 text-warning' : 'bg-burgundy/10 text-danger';
                  const timedTotal = (el.beforeIdeal||0) + (el.beforeMax||0) + (el.afterMax||0);
                  return (
                    <tr key={el.key} className="hover:bg-background/60 transition">
                      <td className="px-3 py-2.5 font-bold text-text-main">{el.name}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-text-main">{el.total ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-extrabold text-accent">{el.approved ?? '—'}</span>
                        {el.total > 0 && el.approved != null && (
                          <span className="text-text-soft/60 text-[9px] mr-1">/{el.total}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {(el.returned || 0) > 0
                          ? <span className="font-bold text-warning">{el.returned}</span>
                          : <span className="text-text-soft/40">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-forest-50">
                            <div className={`h-full rounded-full transition-all ${rate>=80?'bg-accent':rate>=60?'bg-sand':'bg-burgundy'}`} style={{width:`${rate}%`}} />
                          </div>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${rateColor}`}>{fmt(rate)}%</span>
                        </div>
                      </td>
                      {hasTimingData && (
                        <td className="px-3 py-2.5">
                          {timedTotal > 0 ? (
                            <div className="flex items-center gap-1">
                              <TimingBadge
                                icon="✓" count={el.beforeIdeal}
                                color="bg-forest-50 text-accent"
                                tip="قُدِّم قبل الموعد المثالي — يُحسب كـ 100% في مؤشر التوقيت"
                              />
                              <TimingBadge
                                icon="⏱" count={el.beforeMax}
                                color="bg-primary-light text-primary"
                                tip="قُدِّم بعد الموعد المثالي وقبل الأقصى — يُحسب كـ 70% في مؤشر التوقيت"
                              />
                              <TimingBadge
                                icon="⚠" count={el.afterMax}
                                color="bg-burgundy/10 text-danger"
                                tip="قُدِّم بعد الموعد الأقصى — يُحسب كـ 20% أو أقل في مؤشر التوقيت"
                              />
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
              {/* صف الإجمالي */}
              {breakdown.length > 1 && (
                <tfoot className="border-t-2 border-border bg-background/60">
                  <tr>
                    <td className="px-3 py-2.5 font-extrabold text-text-main">الإجمالي</td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-text-main">{totals.total}</td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-accent">{totals.approved}</td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-warning">{totals.returned || '—'}</td>
                    <td className="px-3 py-2.5">
                      {totals.total > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          totals.approved/totals.total >= 0.8 ? 'bg-forest-50 text-accent' : 'bg-sand/20 text-warning'
                        }`}>
                          {Math.round((totals.approved / totals.total) * 100)}%
                        </span>
                      )}
                    </td>
                    {hasTimingData && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 text-[10px]">
                          {totals.beforeIdeal > 0 && <span className="rounded bg-forest-50 text-accent px-1.5 py-0.5 font-bold">✓ {totals.beforeIdeal}</span>}
                          {totals.beforeMax   > 0 && <span className="rounded bg-primary-light text-primary px-1.5 py-0.5 font-bold">⏱ {totals.beforeMax}</span>}
                          {totals.afterMax    > 0 && <span className="rounded bg-burgundy/10 text-danger px-1.5 py-0.5 font-bold">⚠ {totals.afterMax}</span>}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5" />
                  </tr>
                </tfoot>
              )}
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

// ─── HowScoreWorks — شرح طريقة الاحتساب ─────────────────────────────────────

function HowScoreWorks({ snap }) {
  const [open, setOpen] = useState(false);

  const CALC_DETAIL = [
    {
      key: 'productivityScore', icon: '📦', label: 'الإنتاجية', weight: 25,
      formula: 'عدد العناصر المُقدَّمة ÷ عدد العناصر المطلوبة × 100',
      detail:  'يقيس مدى إتمام الموظف لجميع عناصر الإقفال المطلوبة منه. كل عنصر لم يُقدَّم يخفّض الدرجة.',
      good: '≥ 90% تعني إتمام معظم العناصر في الوقت المطلوب.',
    },
    {
      key: 'timelinessScore', icon: '🕐', label: 'التوقيت', weight: 20,
      formula: 'مرجّح: ✓ قبل المثالي = 100% · ⏱ بعد المثالي = 70% · ⚠ بعد الأقصى = 20% أو أقل',
      detail:  'يقيس الالتزام بمواعيد تقديم العناصر. لكل عنصر موعد مثالي وموعد أقصى — التقديم مبكراً يمنح الدرجة الكاملة.',
      good: 'تقديم العناصر قبل الموعد المثالي يعطي 100% في هذا المؤشر.',
    },
    {
      key: 'qualityScore', icon: '⭐', label: 'الجودة', weight: 20,
      formula: 'عدد العناصر المقبولة من أول مرة ÷ إجمالي العناصر المُقدَّمة × 100',
      detail:  'يقيس جودة التقديم — العناصر التي تُعاد تعكس حاجة للتعديل وتخفّض الدرجة. الإعادة مرتان = تأثير أكبر.',
      good: 'تجنّب الإعادة تماماً يعني 100% في الجودة.',
    },
    {
      key: 'criticalScore', icon: '🎯', label: 'العناصر الحرجة', weight: 20,
      formula: 'أداء التقارير (الافتتاح، الاختتام، التقييم) والمستحقات والتسويات المالية',
      detail:  'يركّز على العناصر الأكثر أهمية: تقارير الدورة، الإيرادات، المستحقات، والتسوية. تأخيرها أو إعادتها يخفّض الدرجة بشكل أكبر.',
      good: 'إتمام التقارير في موعدها يضمن درجة عالية في هذا المؤشر.',
    },
    {
      key: 'speedScore', icon: '⚡', label: 'الاستجابة', weight: 10,
      formula: 'متوسط الوقت بين إعادة العنصر وإعادة تقديمه — كلما قلّ كان أفضل',
      detail:  'يقيس سرعة الاستجابة بعد أن يُعيد المشرف عنصراً. الرد خلال 24 ساعة = ممتاز، أكثر من 72 ساعة = يؤثر سلباً.',
      good: 'إعادة التقديم خلال يوم عمل واحد يعطي الدرجة القصوى.',
    },
    {
      key: 'disciplineScore', icon: '🛡️', label: 'الانضباط', weight: 5,
      formula: 'غياب العناصر الراكدة (لم تُحرَّك لأكثر من 7 أيام) وغياب التأخر المتكرر',
      detail:  'يقيس انتظام العمل ومتابعة المهام. وجود عناصر معلّقة لفترة طويلة دون تحريك يخفّض هذا المؤشر.',
      good: 'متابعة جميع العناصر بانتظام يحافظ على انضباط عالٍ.',
    },
  ];

  return (
    <div className="border-t border-border/60">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3 hover:bg-background/60 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-text-soft">🧮 كيف تُحسب الدرجة الكلية؟</span>
          <span className="rounded-lg bg-background border border-border px-2 py-0.5 text-[10px] text-text-soft">اضغط للشرح التفصيلي</span>
        </div>
        <span className="text-[10px] text-text-soft">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {/* الصيغة الكلية */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
            <p className="text-xs font-extrabold text-primary mb-1">صيغة الدرجة الكلية:</p>
            <p className="text-[11px] text-text-main font-mono leading-relaxed">
              الدرجة = (الإنتاجية×25%) + (التوقيت×20%) + (الجودة×20%) + (الحرجة×20%) + (الاستجابة×10%) + (الانضباط×5%)
            </p>
          </div>

          {/* تفصيل كل مؤشر */}
          <div className="space-y-2">
            {CALC_DETAIL.map(ind => {
              const val = Number(snap?.[ind.key] || 0);
              const contribution = (val * ind.weight) / 100;
              const clr = scoreColor(val);
              return (
                <div key={ind.key} className="rounded-xl border border-border bg-background/40 px-4 py-3">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ind.icon}</span>
                      <div>
                        <span className="text-xs font-extrabold text-text-main">{ind.label}</span>
                        <span className="mr-2 text-[10px] text-text-soft">وزن {ind.weight}%</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className={`text-sm font-extrabold ${clr.text}`}>{Math.round(val)}%</span>
                      <span className="text-[10px] text-text-soft mr-1">← يضيف {contribution.toFixed(1)} نقطة</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-soft leading-relaxed mb-1">{ind.detail}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-background border border-border/60 px-2 py-0.5 text-[9px] font-mono text-text-soft">{ind.formula}</span>
                    <span className="text-[9px] text-accent">💡 {ind.good}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* مستويات الأداء */}
          <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
            <p className="text-xs font-extrabold text-text-soft mb-2">مستويات الأداء:</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {[
                { range: '90-100%', label: 'متميز',       color: 'bg-forest-50 text-primary border-primary/20' },
                { range: '80-89%',  label: 'جيد جداً',    color: 'bg-primary-light text-primary border-primary/10' },
                { range: '70-79%',  label: 'جيد',         color: 'bg-background text-text-main border-border' },
                { range: '50-69%',  label: 'يحتاج تحسين', color: 'bg-sand/20 text-warning border-sand/40' },
                { range: '0-49%',   label: 'ضعيف',        color: 'bg-burgundy/10 text-danger border-burgundy/20' },
              ].map(lv => (
                <div key={lv.range} className={`rounded-lg border px-2 py-1.5 text-center ${lv.color}`}>
                  <p className="text-[9px] font-bold">{lv.label}</p>
                  <p className="text-[9px] opacity-70">{lv.range}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-text-soft">
                تفصيل المؤشرات الست — نتيجتك هذا الشهر
              </h3>
              <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                الدرجة الكلية = مجموع (درجة × وزن) لكل مؤشر
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {IND_CFG.map(ind => (
                <IndicatorBar key={ind.key} ind={ind} val={s[ind.key]} showWeight noData={noData} />
              ))}
            </div>
          </div>
        )}

        {/* شرح طريقة الاحتساب */}
        {!noData && <HowScoreWorks snap={s} />}
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

// ─── MultiPeriodPicker ────────────────────────────────────────────────────────

function MultiPeriodPicker({ selectedMonths, onChange }) {
  const now  = new Date();
  // عرض آخر 18 شهر
  const available = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    available.push({ label, name: `${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  const toggle = (label) => {
    if (selectedMonths.includes(label)) {
      onChange(selectedMonths.filter(m => m !== label));
    } else {
      onChange([...selectedMonths, label].sort());
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-text-main">📅 اختر الشهور للمقارنة</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onChange(available.map(a => a.label))}
            className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold text-text-soft hover:border-primary/40 hover:text-primary transition"
          >
            تحديد الكل
          </button>
          <button
            onClick={() => onChange([])}
            className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold text-text-soft hover:border-danger/40 hover:text-danger transition"
          >
            إلغاء الكل
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {available.map(({ label, name }) => {
          const active = selectedMonths.includes(label);
          return (
            <button
              key={label}
              onClick={() => toggle(label)}
              className={`rounded-xl border px-2 py-2.5 text-center text-xs font-bold transition
                ${active
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-background text-text-soft hover:border-primary/40 hover:text-primary'
                }`}
            >
              {name.split(' ')[0]}
              <span className={`block text-[9px] font-normal ${active ? 'text-white/70' : 'text-text-soft/60'}`}>
                {label.slice(0, 4)}
              </span>
            </button>
          );
        })}
      </div>
      {selectedMonths.length > 0 && (
        <p className="mt-2 text-[10px] text-text-soft">
          {selectedMonths.length} شهر محدد: {selectedMonths.map(m => {
            const d = new Date(m + '-01');
            return `${AR_MONTHS[d.getMonth()]}`;
          }).join(' · ')}
        </p>
      )}
    </div>
  );
}

// ─── MultiPeriodResults — عرض نتائج الفترة المخصصة ──────────────────────────

function MultiPeriodResults({ months, isManager }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [nameFilter,    setNameFilter]    = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [levelFilter,   setLevelFilter]   = useState(null);
  const [selectedId,    setSelectedId]    = useState(null);

  useEffect(() => {
    if (!months.length) { setData([]); return; }
    setLoading(true);
    api.get('/analytics/kpi-multi-period', { params: { months: months.join(',') } })
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [months.join(',')]);

  const activeSnaps   = useMemo(() => data.filter(x => x.isSubjectToEvaluation),  [data]);
  const inactiveSnaps = useMemo(() => data.filter(x => !x.isSubjectToEvaluation), [data]);
  const avg = activeSnaps.length
    ? activeSnaps.reduce((a, x) => a + Number(x.finalScore ?? 0), 0) / activeSnaps.length
    : 0;

  const projectList = useMemo(() =>
    [...new Set(data.map(s => s.user?.operationalProject?.name).filter(Boolean))],
    [data]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const key of Object.keys(LEVEL_CFG)) c[key] = activeSnaps.filter(x => x.performanceLevel === key).length;
    return c;
  }, [activeSnaps]);

  const filtered = useMemo(() => {
    let snaps = levelFilter ? activeSnaps.filter(x => x.performanceLevel === levelFilter) : [...activeSnaps, ...inactiveSnaps];
    if (nameFilter)    snaps = snaps.filter(s => `${s.user?.firstName} ${s.user?.lastName}`.includes(nameFilter));
    if (projectFilter) snaps = snaps.filter(s => s.user?.operationalProject?.name === projectFilter);
    return snaps;
  }, [activeSnaps, inactiveSnaps, levelFilter, nameFilter, projectFilter]);

  if (!months.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center shadow-card">
        <div className="mb-3 text-4xl">📅</div>
        <p className="text-sm font-bold text-text-main">حدد الشهور أعلاه لعرض النتائج المجمّعة</p>
        <p className="mt-1 text-xs text-text-soft">يمكنك اختيار أي مجموعة من الشهور ثم مقارنة أداء الفريق</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-text-soft">جاري تجميع النتائج...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ملخص الفترة */}
      {activeSnaps.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-background/40">
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-light px-4 py-1.5">
              <span className="text-base font-extrabold text-primary">{avg.toFixed(1)}%</span>
              <span className="text-xs text-text-soft">متوسط الفريق</span>
              <span className="text-[10px] text-text-soft">({activeSnaps.length} موظف)</span>
            </div>

            <div className="h-5 w-px bg-border" />

            {LEVEL_ORDER.map(key => counts[key] > 0 && (
              <StatsPill
                key={key}
                label={LEVEL_CFG[key].label}
                value={counts[key]}
                active={levelFilter === key}
                onClick={() => setLevelFilter(v => v === key ? null : key)}
              />
            ))}

            {levelFilter && (
              <button onClick={() => setLevelFilter(null)}
                className="rounded-xl border border-border px-2.5 py-1.5 text-[10px] text-text-soft hover:text-danger transition">
                ✕ إلغاء
              </button>
            )}

            <div className="h-5 w-px bg-border" />

            <input
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              placeholder="🔍 بحث باسم..."
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-36"
            />

            {projectList.length > 1 && (
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">كل المشاريع</option>
                {projectList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          {/* جدول النتائج */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/60">
                  <th className="px-4 py-2.5 text-right font-extrabold text-text-soft">#</th>
                  <th className="px-4 py-2.5 text-right font-extrabold text-text-soft">الموظف</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft">المستوى</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft">الدرجة الكلية</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft" title="نسبة إتمام عناصر الإقفال">📦 الإنتاجية</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft" title="الالتزام بمواعيد التقديم">🕐 التوقيت</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft" title="نسبة القبول من أول مرة">⭐ الجودة</th>
                  <th className="px-4 py-2.5 text-center font-extrabold text-text-soft">الشهور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((snap, idx) => {
                  const name  = `${snap.user?.firstName || ''} ${snap.user?.lastName || ''}`.trim();
                  const proj  = snap.user?.operationalProject?.name || '—';
                  const ini   = initials(snap.user?.firstName, snap.user?.lastName);
                  const score = Number(snap.finalScore ?? 0);
                  const noData = !snap.isSubjectToEvaluation;
                  const clr   = scoreColor(score);
                  const level = snap.performanceLevel;
                  const lcfg  = LEVEL_CFG[level] || LEVEL_CFG.GOOD;
                  const isSelected = selectedId === snap.userId;

                  return (
                    <Fragment key={snap.userId}>
                      <tr
                        onClick={() => setSelectedId(isSelected ? null : snap.userId)}
                        className={`cursor-pointer transition hover:bg-background/60 ${isSelected ? 'bg-primary-light/40' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-text-soft">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                              style={{ backgroundColor: noData ? '#9DA3A1' : lcfg.color }}>
                              {ini}
                            </div>
                            <div>
                              <p className="font-bold text-text-main">{name}</p>
                              <p className="text-[10px] text-text-soft">{proj}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <LevelBadge level={level} noData={noData} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {noData ? <span className="text-text-soft/40">—</span> : (
                            <span className={`font-extrabold ${clr.text}`}>{score.toFixed(1)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {noData ? '—' : <span className={scoreColor(snap.productivityScore).text}>{fmt(snap.productivityScore)}%</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {noData ? '—' : <span className={scoreColor(snap.timelinessScore).text}>{fmt(snap.timelinessScore)}%</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {noData ? '—' : <span className={scoreColor(snap.qualityScore).text}>{fmt(snap.qualityScore)}%</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-text-soft">{snap.monthsIncluded}/{snap.monthsTotal}</span>
                        </td>
                      </tr>
                      {/* تفاصيل الشهور عند فتح الصف */}
                      {isSelected && (
                        <tr className="bg-primary-light/20">
                          <td colSpan={8} className="px-6 py-3">
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              <span className="font-bold text-text-soft">تفصيل الشهور:</span>
                              {snap.monthDetail?.map(md => {
                                const d = new Date(md.periodLabel + '-01');
                                const mName = `${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
                                return (
                                  <span
                                    key={md.periodLabel}
                                    className={`rounded-lg border px-2 py-1 font-bold ${
                                      !md.isSubjectToEvaluation
                                        ? 'border-border bg-background text-text-soft/60'
                                        : md.finalScore >= 80 ? 'border-accent/30 bg-forest-50 text-accent'
                                        : md.finalScore >= 60 ? 'border-sand/40 bg-sand/10 text-warning'
                                        : 'border-burgundy/30 bg-burgundy/5 text-danger'
                                    }`}
                                  >
                                    {mName}: {md.isSubjectToEvaluation ? `${md.finalScore?.toFixed(1)}%` : 'لا بيانات'}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center shadow-card">
          <p className="text-sm text-text-soft">لا توجد بيانات لهذه الشهور — تأكد من أن المؤشرات محتسبة لكل شهر</p>
        </div>
      )}
    </div>
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
  const [periodMode, setPeriodMode] = useState('monthly'); // 'monthly' | 'yearly' | 'custom'
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customMonths, setCustomMonths] = useState([]);
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
  const [nameFilter,   setNameFilter]   = useState('');
  const [projectFilter,setProjectFilter]= useState('');

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

  const projectList = useMemo(() =>
    [...new Set(snapshots.map(s => s.user?.operationalProject?.name).filter(Boolean))],
    [snapshots],
  );

  const filteredSnaps = useMemo(() => {
    let snaps = levelFilter ? activeSnaps.filter(x => x.performanceLevel === levelFilter) : [...activeSnaps, ...inactiveSnaps];
    if (nameFilter)    snaps = snaps.filter(s => `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.includes(nameFilter));
    if (projectFilter) snaps = snaps.filter(s => s.user?.operationalProject?.name === projectFilter);
    return snaps;
  }, [activeSnaps, inactiveSnaps, levelFilter, nameFilter, projectFilter]);

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

            {/* تبويب شهري / سنوي / مخصص */}
            <div className="flex overflow-hidden rounded-xl border border-border text-xs font-bold">
              {[
                { key: 'monthly', label: 'شهري' },
                { key: 'yearly',  label: 'سنوي'  },
                ...((isManager || isSupervisor) ? [{ key: 'custom', label: '📅 فترة مخصصة' }] : []),
              ].map(({ key, label }) => (
                <button key={key}
                  onClick={() => { setPeriodMode(key); setSelectedId(null); setSelectedSnap(null); }}
                  className={`px-4 py-2 transition ${periodMode===key ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* تنقل الأشهر — لا يظهر في وضع مخصص */}
            <div className={`flex items-center gap-2 ${periodMode === 'custom' ? 'hidden' : ''}`}>
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
              {isManager && periodMode !== 'custom' && (
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
          {periodMode !== 'custom' && !loading && snapshots.length > 0 && !isEmployee && (
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

              <div className="h-5 w-px bg-border" />

              {/* بحث بالاسم */}
              <input
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                placeholder="🔍 بحث باسم الموظف..."
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-40"
              />

              {/* فلتر المشروع */}
              {projectList.length > 1 && (
                <select
                  value={projectFilter}
                  onChange={e => setProjectFilter(e.target.value)}
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">كل المشاريع</option>
                  {projectList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}

              {(nameFilter || projectFilter) && (
                <button
                  onClick={() => { setNameFilter(''); setProjectFilter(''); }}
                  className="rounded-xl border border-border px-2.5 py-1.5 text-[10px] text-text-soft hover:text-danger transition"
                >
                  ✕ مسح البحث
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

        {/* ══════ وضع الفترة المخصصة ══════ */}
        {periodMode === 'custom' && (
          <div className="space-y-4">
            <MultiPeriodPicker selectedMonths={customMonths} onChange={setCustomMonths} />
            <MultiPeriodResults months={customMonths} isManager={isManager} />
          </div>
        )}

        {/* ══════ حالة التحميل ══════ */}
        {periodMode !== 'custom' && loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-text-soft">{t('kpi.loadingMonth', { month: monthName(locale, month, year) })}</span>
            </div>
          </div>
        )}

        {/* ══════ حالة فارغة ══════ */}
        {periodMode !== 'custom' && !loading && snapshots.length === 0 && (
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
        {periodMode !== 'custom' && !loading && isEmployee && snapshots.length > 0 && (
          <EmployeePersonalView snap={snapshots[0]} month={month} year={year} />
        )}

        {/* ══════ لوحة ترتيب المشاريع — مدير/مشرف ══════ */}
        {periodMode !== 'custom' && !loading && (isManager || isSupervisor) && periodMode === 'monthly' && (
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
        {periodMode !== 'custom' && !loading && teamBarData.length > 1 && !isEmployee && (
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
        {periodMode !== 'custom' && !loading && filteredSnaps.length > 0 && !isEmployee && (
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
        {periodMode !== 'custom' && !loading && !isEmployee && (loadingDet || selectedSnap) && (
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

        {/* ══════ لوحة أداء المشرف الذاتية ══════ */}
        {periodMode !== 'custom' && isSupervisor && !isManager && <MySupervisorStats />}

        {/* ══════ تقرير المشرفين + سجل الإسناد — مدير فقط ══════ */}
        {periodMode !== 'custom' && isManager && <SupervisorReport periodLabel={periodLabel} />}
        {periodMode !== 'custom' && isManager && <AssignmentSection periodLabel={periodLabel} year={year} month={month} />}

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
                    {['المشرف', 'إجمالي البت', 'معتمد', 'مُعاد', 'مرفوض', 'معدل الاعتماد', 'متوسط وقت البت', 'التقييم', 'معلّق عاجل 🔴'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-right font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(s => (
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
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RESP_COLOR[s.responsiveness] || 'bg-background text-text-soft border-border'}`}>
                          {s.responsiveness || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {s.pendingUrgent > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/10 border border-burgundy/30 px-2 py-0.5 text-[10px] font-extrabold text-danger">
                            🔴 {s.pendingUrgent}
                          </span>
                        ) : s.pendingTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sand/10 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">
                            ⏳ {s.pendingTotal}
                          </span>
                        ) : (
                          <span className="text-[10px] text-accent font-bold">✅</span>
                        )}
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

// ─── لوحة أداء المشرف الذاتية ────────────────────────────────────────────────

function MySupervisorStats() {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/kpis/my-supervisor-stats')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-8 shadow-card text-sm text-text-soft">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      جاري تحميل إحصائياتك...
    </div>
  );

  if (!data) return null;

  const RESP_STYLE = {
    'سريع جداً': { bg: 'bg-forest-50 border-forest-200', text: 'text-accent',   icon: '⚡' },
    'مقبول':     { bg: 'bg-primary-light border-primary/20', text: 'text-primary', icon: '✅' },
    'بطيء':      { bg: 'bg-sand/20 border-sand/50',         text: 'text-warning', icon: '⏳' },
    'متأخر':     { bg: 'bg-burgundy/10 border-burgundy/30', text: 'text-danger',  icon: '🔴' },
  };
  const resp = RESP_STYLE[data.responsiveness] || { bg: 'bg-background border-border', text: 'text-text-soft', icon: '—' };

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-card">
      {/* الرأس */}
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-primary/5 to-white px-5 py-3.5">
        <div>
          <h3 className="font-extrabold text-text-main">📋 لوحة أدائك كمشرف</h3>
          <p className="text-[10px] text-text-soft mt-0.5">مدى سرعتك في البت بعناصر فريقك</p>
        </div>
        {data.responsiveness && (
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${resp.bg} ${resp.text}`}>
            {resp.icon} {data.responsiveness}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* تنبيه العناصر العاجلة */}
        {data.urgentCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-burgundy/30 bg-burgundy/8 px-4 py-3.5">
            <span className="text-2xl shrink-0 mt-0.5">🔴</span>
            <div>
              <p className="font-extrabold text-danger text-sm">
                {data.urgentCount} عنصر ينتظر بتّك منذ أكثر من 3 أيام!
              </p>
              <p className="text-xs text-danger/70 mt-0.5">
                هذا التأخر يؤثر سلباً على سير العمل — يُنصح بمراجعتها الآن
              </p>
            </div>
          </div>
        )}

        {/* إشعار معتدل */}
        {data.urgentCount === 0 && data.moderateCount > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-sand/50 bg-sand/10 px-4 py-3.5">
            <span className="text-2xl shrink-0 mt-0.5">⏳</span>
            <div>
              <p className="font-extrabold text-warning text-sm">
                {data.moderateCount} عنصر بانتظار بتّك (بين يوم و3 أيام)
              </p>
              <p className="text-xs text-warning/70 mt-0.5">راجعها قريباً قبل أن تصبح عاجلة</p>
            </div>
          </div>
        )}

        {/* حالة جيدة */}
        {data.pendingTotal === 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3.5">
            <span className="text-2xl">✅</span>
            <p className="font-extrabold text-accent text-sm">أحسنت! لا توجد عناصر معلّقة بانتظار بتّك</p>
          </div>
        )}

        {/* الإحصائيات الأربع */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'إجمالي بتّاتك',    val: data.totalDecisions,  color: 'text-primary' },
            { label: 'معتمدة',            val: data.approved,        color: 'text-accent' },
            { label: 'معلّقة الآن',       val: data.pendingTotal,    color: data.pendingTotal > 0 ? 'text-warning' : 'text-text-soft' },
            { label: 'متوسط وقت البت',   val: data.avgResponseHours != null ? fmtDur(t, data.avgResponseHours) : '—', color: 'text-text-main' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-[10px] text-text-soft mb-0.5">{c.label}</p>
              <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* العناصر العاجلة */}
        {data.urgentItems?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-extrabold text-danger uppercase tracking-wide">
              🔴 عناصر عاجلة — تحتاج بتّك فوراً
            </h4>
            <div className="space-y-1.5">
              {data.urgentItems.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-burgundy/20 bg-burgundy/5 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-main truncate">
                      {item.executedBy?.firstName} {item.executedBy?.lastName}
                      <span className="text-text-soft font-normal"> · {item.element?.name}</span>
                    </p>
                    <p className="text-[10px] text-text-soft truncate">{item.course?.name}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold text-danger bg-burgundy/10 rounded-full px-2 py-0.5">
                    منذ {fmtDur(t, item.ageHours)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
