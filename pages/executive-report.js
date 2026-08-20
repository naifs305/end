// صفحة التقرير القيادي الشهري — مدير ومشرف مشروع
import { useState, useEffect, useRef } from 'react';
import { BarChart3, Download, BookOpen, Sparkles, CheckCircle2, AlertTriangle, Hourglass, CircleDot, Trophy, Users } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import { useRouter } from 'next/router';
import { useTranslation } from '../lib/i18n';

// ── أسماء الأشهر الإنجليزية (تُستخدم داخل PDF بخط لاتيني فقط) ──────────────
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// تسميات المستوى الإنجليزية (لجدول PDF اللاتيني)
const LEVEL_LABEL_EN = {
  OUTSTANDING:       'Outstanding',
  VERY_GOOD:         'Very Good',
  GOOD:              'Good',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  WEAK:              'Weak',
};

const LEVEL_CLS = {
  OUTSTANDING:       'bg-forest-50 text-primary border-primary/30',
  VERY_GOOD:         'bg-primary-light text-primary border-primary/20',
  GOOD:              'bg-forest-100 text-text-main border-forest-200',
  NEEDS_IMPROVEMENT: 'bg-sand/20 text-warning border-sand/40',
  WEAK:              'bg-burgundy/10 text-danger border-burgundy/20',
};

const LEVEL_COLOR = {
  OUTSTANDING: '#253C32', VERY_GOOD: '#5D8A70', GOOD: '#9DA3A1',
  NEEDS_IMPROVEMENT: '#C3B39F', WEAK: '#633646',
};

const LEVEL_ORDER = ['OUTSTANDING', 'VERY_GOOD', 'GOOD', 'NEEDS_IMPROVEMENT', 'WEAK'];

function fmt(v, d = 1) {
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

// ── مكون: بطاقة إحصائية ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, danger = false, Icon }) {
  const bg = danger
    ? 'border-burgundy/20 bg-burgundy/5'
    : accent
    ? 'border-primary/20 bg-primary-light'
    : 'border-border bg-white';
  const val = danger
    ? 'text-danger'
    : accent
    ? 'text-primary'
    : 'text-text-main';
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-soft mb-1">{label}</p>
          <p className={`text-3xl font-extrabold ${val}`}>{value}</p>
          {sub && <p className="mt-1 text-[11px] text-text-soft">{sub}</p>}
        </div>
        {Icon && <Icon size={24} aria-hidden="true" className="text-text-soft/60" />}
      </div>
    </div>
  );
}

// ── مكون: شريط تقدم ─────────────────────────────────────────────────────
function ProgressBar({ label, value, total, color = '#253C32' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-main font-medium">{label}</span>
        <span className="font-extrabold text-text-soft">{value} <span className="text-text-soft/60">({pct}%)</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-forest-50">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── مكون: جدول الأداء ───────────────────────────────────────────────────
function PerfRow({ rank, name, project, score, level, color, t }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 bg-white">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
        style={{ backgroundColor: color }}>{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-text-main">{name}</p>
        <p className="truncate text-[10px] text-text-soft">{project || '-'}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-forest-50">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(score))}%`, backgroundColor: color }} />
        </div>
        <span className="w-12 text-end text-xs font-extrabold text-text-main">{fmt(score)}%</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${LEVEL_CLS[level] || ''}`}>
          {level ? t(`performanceLevel.${level}`) : level}
        </span>
      </div>
    </div>
  );
}

// ── المكون الرئيسي ──────────────────────────────────────────────────────
export default function ExecutiveReportPage() {
  const { activeRole } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
  // اسم الشهر المترجم حسب اللغة الحالية
  const monthName = (m) => new Date(2000, m - 1, 1).toLocaleDateString(intl, { month: 'long' });

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  // قائمة السنوات الديناميكية: السنة الحالية والثلاث السابقة
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // حماية — فقط مدير ومشرف
  useEffect(() => {
    if (activeRole && activeRole !== 'MANAGER' && activeRole !== 'PROJECT_SUPERVISOR') {
      router.replace('/');
    }
  }, [activeRole, router]);

  // جلب البيانات
  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/executive-report?year=${year}&month=${month}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [year, month]);

  // ── تصدير PDF (محتوى لاتيني — يبقى بالإنجليزية لضمان عرض الخط) ───────────
  const handleExportPDF = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable  = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(37, 60, 50);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Monthly Report', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${MONTHS_EN[month - 1]} ${year}  |  Generated: ${new Date().toLocaleDateString('en-SA')}`, pageW / 2, 21, { align: 'center' });

      let y = 36;

      // ── الدورات ──
      doc.setTextColor(37, 60, 50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Courses Summary', 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Courses',              data.courses.total],
          ['New This Period',            data.courses.newThisPeriod],
          ['Closed This Period',         data.courses.closedThisPeriod],
          ['Overdue (not closed)',        data.courses.overdueNotClosed],
        ],
        styles: { fontSize: 10, cellPadding: 3, halign: 'left' },
        headStyles: { fillColor: [37, 60, 50], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [235, 243, 238] },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto',
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── عناصر الإغلاق ──
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Closure Elements', 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Elements',      data.elements.total],
          ['Approved',            `${data.elements.approved} (${data.elements.completionRate}%)`],
          ['Pending Approval',    data.elements.pending],
          ['Not Started',         data.elements.notStarted],
          ['Returned',            data.elements.returned],
        ],
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 60, 50], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [235, 243, 238] },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto',
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── KPI ──
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('KPI Summary', 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Team Avg Score',     `${fmt(data.kpi.avgScore)}%`],
          ['Evaluated Employees', data.kpi.activeEmployees],
          ['Outstanding',         data.kpi.levelCounts.OUTSTANDING || 0],
          ['Very Good',           data.kpi.levelCounts.VERY_GOOD   || 0],
          ['Good',                data.kpi.levelCounts.GOOD        || 0],
          ['Needs Improvement',   data.kpi.levelCounts.NEEDS_IMPROVEMENT || 0],
          ['Weak',                data.kpi.levelCounts.WEAK        || 0],
        ],
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 60, 50], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [235, 243, 238] },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto',
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── أفضل الموظفين ──
      if (data.kpi.top3?.length) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Top Performers', 14, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [['Rank', 'Name', 'Project', 'Score', 'Level']],
          body: data.kpi.top3.map((e, i) => [i + 1, e.name, e.project, `${e.score}%`, LEVEL_LABEL_EN[e.level] || e.level]),
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [37, 60, 50], textColor: [255,255,255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [235, 243, 238] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── يحتاجون اهتماماً ──
      if (data.kpi.needsAttention?.length) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 54, 70);
        doc.text('Needs Attention (< 60%)', 14, y);
        doc.setTextColor(37, 60, 50);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [['Name', 'Project', 'Score']],
          body: data.kpi.needsAttention.map(e => [e.name, e.project, `${e.score}%`]),
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [99, 54, 70], textColor: [255,255,255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [253, 242, 244] },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageW - 14, 290, { align: 'right' });
        doc.text('NAUSS — Training Closure Platform', 14, 290);
      }

      doc.save(`executive-report-${year}-${String(month).padStart(2,'0')}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  // ── الحماية أثناء التحميل ──────────────────────────────────────────────
  if (activeRole && activeRole !== 'MANAGER' && activeRole !== 'PROJECT_SUPERVISOR') return null;

  // ── KPI level distribution للرسم ───────────────────────────────────────
  const levelData = data ? LEVEL_ORDER.map((lv) => ({
    key: lv,
    name: t(`performanceLevel.${lv}`),
    value: data.kpi.levelCounts[lv] || 0,
    fill: LEVEL_COLOR[lv],
  })).filter(d => d.value > 0) : [];

  return (
    <MainLayout>
      <div ref={reportRef} className="space-y-5">

        {/* رأس الصفحة */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="inline-flex items-center gap-2 text-xl font-extrabold text-primary">
                <BarChart3 size={22} aria-hidden="true" /> {t('exec.title')}
              </h1>
              <p className="mt-0.5 text-xs text-text-soft">{t('exec.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* اختيار الشهر */}
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{monthName(m)}</option>
                ))}
              </select>
              {/* اختيار السنة */}
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {/* تصدير PDF */}
              <button
                onClick={handleExportPDF}
                disabled={exporting || loading || !data}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50 transition"
              >
                {exporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Download size={16} aria-hidden="true" />
                )}
                {t('exec.exportPdf')}
              </button>
            </div>
          </div>
          {data && (
            <div className="mt-2 text-[11px] text-text-soft/70">
              {t('exec.reportFor', { month: monthName(month), year })} — {t('exec.generatedAt', { date: new Date(data.generatedAt).toLocaleString(intl) })}
            </div>
          )}
        </div>

        {/* حالة التحميل */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-danger/20 bg-white p-8 text-center shadow-card">
            <p className="text-danger font-bold">{t('exec.loadFailed')}</p>
            <p className="mt-1 text-xs text-text-soft">{t('exec.loadFailedHint')}</p>
          </div>
        ) : (
          <>
            {/* ── قسم الدورات ──────────────────────────────────────────── */}
            <div>
              <h2 className="mb-2 px-1 text-sm font-extrabold uppercase tracking-widest text-text-soft/60">{t('exec.coursesSection')}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label={t('exec.totalCourses')}
                  value={data.courses.total}
                  Icon={BookOpen}
                  accent
                />
                <StatCard
                  label={t('exec.newCourses')}
                  value={data.courses.newThisPeriod}
                  sub={`${monthName(month)} ${year}`}
                  Icon={Sparkles}
                />
                <StatCard
                  label={t('exec.closedThisMonth')}
                  value={data.courses.closedThisPeriod}
                  Icon={CheckCircle2}
                  accent={data.courses.closedThisPeriod > 0}
                />
                <StatCard
                  label={t('exec.overdueCourses')}
                  value={data.courses.overdueNotClosed}
                  Icon={AlertTriangle}
                  danger={data.courses.overdueNotClosed > 0}
                />
              </div>
            </div>

            {/* ── قسم عناصر الإغلاق ───────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-text-main">{t('exec.closureElements')}</h2>
                  <p className="text-[11px] text-text-soft">{t('exec.elementsTotal', { count: data.elements.total })}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-light px-4 py-2">
                  <span className="text-2xl font-extrabold text-primary">{data.elements.completionRate}%</span>
                  <div className="text-[10px] text-text-soft">{t('exec.completionRate')}</div>
                </div>
              </div>
              <div className="space-y-3">
                <ProgressBar label={t('elementStatus.APPROVED')} value={data.elements.approved}   total={data.elements.total} color="#5D8A70" />
                <ProgressBar label={t('elementStatus.PENDING_APPROVAL')} value={data.elements.pending}    total={data.elements.total} color="#C3B39F" />
                <ProgressBar label={t('elementStatus.NOT_STARTED')} value={data.elements.notStarted} total={data.elements.total} color="#9DA3A1" />
                <ProgressBar label={t('elementStatus.RETURNED')}  value={data.elements.returned}   total={data.elements.total} color="#633646" />
              </div>
              {data.elements.pending > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs text-warning">
                  <Hourglass size={14} aria-hidden="true" className="shrink-0" />
                  <span>{t('exec.pendingNotice', { count: data.elements.pending })}</span>
                </div>
              )}
              {data.courses.overdueNotClosed > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-xs text-danger">
                  <CircleDot size={14} aria-hidden="true" className="shrink-0" />
                  <span>{t('exec.overdueNotice', { count: data.courses.overdueNotClosed })}</span>
                </div>
              )}
            </div>

            {/* ── قسم KPI ──────────────────────────────────────────────── */}
            <div>
              <h2 className="mb-2 px-1 text-sm font-extrabold uppercase tracking-widest text-text-soft/60">{t('exec.kpiSection', { month: monthName(month), year })}</h2>

              {data.kpi.activeEmployees === 0 ? (
                <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-soft shadow-card">
                  {t('exec.noKpi')}
                </div>
              ) : (
                <>
                  {/* بطاقات KPI */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
                    <div className="rounded-2xl border border-primary/20 bg-primary p-4 shadow-card text-white">
                      <p className="text-xs opacity-70">{t('exec.teamAvg')}</p>
                      <p className="text-3xl font-extrabold">{fmt(data.kpi.avgScore)}%</p>
                      <p className="mt-1 text-[11px] opacity-60">{t('exec.evaluatedEmployees', { count: data.kpi.activeEmployees })}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
                      <p className="text-xs text-text-soft">{t('exec.outstandingPlusVeryGood')}</p>
                      <p className="text-3xl font-extrabold text-primary">
                        {(data.kpi.levelCounts.OUTSTANDING || 0) + (data.kpi.levelCounts.VERY_GOOD || 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-text-soft">{t('exec.highPerformers')}</p>
                    </div>
                    <div className={`rounded-2xl border p-4 shadow-card ${
                      (data.kpi.needsAttention?.length || 0) > 0
                        ? 'border-burgundy/20 bg-burgundy/5'
                        : 'border-border bg-white'
                    }`}>
                      <p className={`text-xs ${(data.kpi.needsAttention?.length||0) > 0 ? 'text-danger' : 'text-text-soft'}`}>
                        {t('exec.needsFollowup')}
                      </p>
                      <p className={`text-3xl font-extrabold ${(data.kpi.needsAttention?.length||0) > 0 ? 'text-danger' : 'text-text-main'}`}>
                        {data.kpi.needsAttention?.length || 0}
                      </p>
                      <p className="mt-1 text-[11px] text-text-soft">{t('exec.below60')}</p>
                    </div>
                  </div>

                  {/* توزيع مستويات الأداء */}
                  {levelData.length > 0 && (
                    <div className="mb-4 rounded-2xl border border-border bg-white p-5 shadow-card">
                      <h3 className="mb-4 font-extrabold text-text-main">{t('exec.levelDistribution')}</h3>
                      <div className="space-y-2.5">
                        {levelData.map(lv => (
                          <div key={lv.key} className="flex items-center gap-3">
                            <span className="w-24 text-end text-xs text-text-main shrink-0">{lv.name}</span>
                            <div className="flex-1 h-2 overflow-hidden rounded-full bg-forest-50">
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.round((lv.value / data.kpi.activeEmployees) * 100)}%`,
                                  backgroundColor: lv.fill,
                                }} />
                            </div>
                            <span className="w-6 text-end text-xs font-extrabold text-text-soft">{lv.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* أفضل 3 موظفين + من يحتاجون متابعة */}
                  <div className="grid gap-4 sm:grid-cols-2">

                    {/* أفضل الأداء */}
                    {data.kpi.top3?.length > 0 && (
                      <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
                        <h3 className="mb-3 inline-flex items-center gap-1.5 font-extrabold text-text-main">
                          <Trophy size={16} aria-hidden="true" className="text-accent" /> {t('exec.topPerformers')}
                        </h3>
                        <div className="space-y-2">
                          {data.kpi.top3.map((e, i) => (
                            <PerfRow
                              key={i}
                              rank={i + 1}
                              name={e.name}
                              project={e.project}
                              score={e.score}
                              level={e.level}
                              color={i === 0 ? '#253C32' : i === 1 ? '#5D8A70' : '#9DA3A1'}
                              t={t}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* يحتاجون متابعة */}
                    {data.kpi.needsAttention?.length > 0 && (
                      <div className="rounded-2xl border border-burgundy/20 bg-white p-4 shadow-card">
                        <h3 className="mb-3 inline-flex items-center gap-1.5 font-extrabold text-danger">
                          <AlertTriangle size={16} aria-hidden="true" /> {t('exec.needsAttentionTitle')}
                        </h3>
                        <div className="space-y-2">
                          {data.kpi.needsAttention.map((e, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl border border-burgundy/10 bg-burgundy/5 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-bold text-text-main">{e.name}</p>
                                <p className="truncate text-[10px] text-text-soft">{e.project || '-'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-forest-50">
                                  <div className="h-full rounded-full bg-danger"
                                    style={{ width: `${Math.min(100, Number(e.score))}%` }} />
                                </div>
                                <span className="text-xs font-extrabold text-danger w-10 text-end">{fmt(e.score)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── قسم الفريق ───────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <h2 className="mb-4 inline-flex items-center gap-1.5 font-extrabold text-text-main">
                <Users size={18} aria-hidden="true" /> {t('exec.teamSection')}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-2xl font-extrabold text-primary">{data.team.employees}</p>
                  <p className="mt-0.5 text-xs text-text-soft">{t('exec.coordinators')}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-2xl font-extrabold text-primary">{data.team.supervisors}</p>
                  <p className="mt-0.5 text-xs text-text-soft">{t('roles.PROJECT_SUPERVISOR')}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-2xl font-extrabold text-primary">
                    {data.team.employees + data.team.supervisors}
                  </p>
                  <p className="mt-0.5 text-xs text-text-soft">{t('exec.totalActive')}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-2xl font-extrabold text-primary">{data.kpi.activeEmployees}</p>
                  <p className="mt-0.5 text-xs text-text-soft">{t('exec.evaluatedThisMonth')}</p>
                </div>
              </div>
            </div>

            {/* تذييل التقرير */}
            <div className="rounded-2xl border border-border bg-white px-5 py-3 shadow-card">
              <div className="flex items-center justify-between text-[11px] text-text-soft/60">
                <span>{t('common.appName')} — {t('common.university')}</span>
                <span>{t('exec.reportFor', { month: monthName(month), year })}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
