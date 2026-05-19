import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const RadarKPI      = dynamic(() => import('../components/charts/RadarKPI'),      { ssr: false });
const TeamBarChart  = dynamic(() => import('../components/charts/TeamBarChart'),  { ssr: false });

// ======================================================================
// ثوابت وأدوات
// ======================================================================

const PERIOD_TYPES = [
  { value: 'MONTHLY', label: 'شهري' },
  { value: 'QUARTERLY', label: 'ربع سنوي' },
  { value: 'YEARLY', label: 'سنوي' },
];

const QUARTERS = [1, 2, 3, 4].map((q) => ({ value: q, label: `الربع ${['الأول','الثاني','الثالث','الرابع'][q-1]}` }));

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('ar-SA', { month: 'long' }),
}));

const LEVEL_TONE = {
  OUTSTANDING: 'green',
  VERY_GOOD: 'blue',
  GOOD: 'gray',
  NEEDS_IMPROVEMENT: 'amber',
  WEAK: 'red',
};

const INSIGHT_ICON = { positive: '✅', warning: '⚠️', critical: '🔴', info: 'ℹ️' };
const INSIGHT_BG   = { positive: 'bg-emerald-50 border-emerald-200 text-emerald-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', critical: 'bg-red-50 border-red-200 text-red-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };

function fmt(v, d = 1) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

function scoreColor(v) {
  if (v >= 80) return 'bg-emerald-500';
  if (v >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

function scoreTone(v) {
  if (v >= 80) return 'text-emerald-700';
  if (v >= 60) return 'text-amber-700';
  return 'text-red-600';
}

// ======================================================================
// مكونات صغيرة
// ======================================================================

function Badge({ children, tone = 'gray' }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red:   'bg-red-50 text-red-600 border-red-200',
    gray:  'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls[tone] || cls.gray}`}>
      {children}
    </span>
  );
}

function ScoreBar({ label, score, weight, color }) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-text-main">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-soft">وزن {weight}%</span>
          <span className={`text-sm font-extrabold ${scoreTone(pct)}`}>{fmt(pct)}%</span>
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color || scoreColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, value, sub, tone = 'primary' }) {
  const colors = { primary: 'text-primary', green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' };
  return (
    <div className="rounded-3xl border border-border bg-white p-4 shadow-card">
      <div className="mb-1 text-xs font-medium text-text-soft">{title}</div>
      <div className={`text-2xl font-extrabold ${colors[tone] || colors.primary}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-text-soft">{sub}</div> : null}
    </div>
  );
}

// ======================================================================
// مكون لوح التفاصيل — 6 مؤشرات + تفصيل العناصر + الرؤى + الاتجاه
// ======================================================================

function SnapshotDetails({ snapshot, isManager, onNoteAdded }) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [trend, setTrend] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const s = snapshot;

  useEffect(() => {
    if (!s?.userId) return;
    setLoadingTrend(true);
    api.get(`/kpis/trend/${s.userId}`, { params: { periodType: s.periodType, periodsCount: 6 } })
      .then((r) => setTrend(r.data))
      .catch(() => {})
      .finally(() => setLoadingTrend(false));
  }, [s?.userId, s?.periodType]);

  const handleSaveNote = async () => {
    if (!note.trim()) { toast.error('اكتب الملاحظة أولاً'); return; }
    setSavingNote(true);
    try {
      await api.post(`/kpis/${s.id}/notes`, { userId: s.userId, note: note.trim() });
      toast.success('تم حفظ الملاحظة');
      setNote('');
      onNoteAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر الحفظ');
    } finally {
      setSavingNote(false);
    }
  };

  // المؤشرات الست (4 مخزنة + اشتقاق تقديري للباقيَين)
  const indicators = [
    { label: 'الإنتاجية والإتمام', score: s.productivityScore, weight: 25 },
    { label: 'الالتزام بالمواعيد', score: s.timelinessScore ?? s.speedScore, weight: 20 },
    { label: 'جودة التقديم', score: s.qualityScore, weight: 20 },
    { label: 'العناصر الحرجة', score: s.criticalScore ?? s.qualityScore, weight: 20 },
    { label: 'سرعة الاستجابة', score: s.speedScore, weight: 10 },
    { label: 'الانضباط العام', score: s.disciplineScore, weight: 5 },
  ];

  const finalScore = Number(s.finalScore) || 0;
  const levelTone = LEVEL_TONE[s.performanceLevel] || 'gray';

  return (
    <div className="space-y-5 rounded-3xl border border-border bg-white p-5 shadow-card">

      {/* رأس اللوح */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-primary">
            {s.user?.firstName} {s.user?.lastName}
          </h3>
          <p className="mt-1 text-sm text-text-soft">
            {s.user?.operationalProject?.name || '-'} — {s.periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-2xl px-4 py-2 text-2xl font-extrabold ${scoreTone(finalScore)}`}>
            {fmt(finalScore)}%
          </span>
          <Badge tone={levelTone}>{s.performanceLevelLabel || s.performanceLevel}</Badge>
          <Badge tone={s.commitmentStatus === 'COMMITTED' ? 'green' : s.commitmentStatus === 'NOT_COMMITTED' ? 'red' : 'amber'}>
            {s.commitmentStatusLabel || '-'}
          </Badge>
          <Badge tone={s.disciplineStatus === 'DISCIPLINED' ? 'green' : s.disciplineStatus === 'UNDISCIPLINED' ? 'red' : 'amber'}>
            {s.disciplineStatusLabel || '-'}
          </Badge>
        </div>
      </div>

      {/* بطاقات ملخص */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard title="الدورات المسندة"  value={s.assignedCoursesCount ?? 0} />
        <SummaryCard title="الدورات الفعلية"  value={s.actualCoursesCount ?? 0} tone={s.actualCoursesCount >= s.assignedCoursesCount ? 'green' : 'amber'} />
        <SummaryCard title="إتمام العناصر"    value={`${fmt(s.closureCompletionRate)}%`} tone={s.closureCompletionRate >= 80 ? 'green' : s.closureCompletionRate >= 60 ? 'amber' : 'red'} />
        <SummaryCard title="الدرجة النهائية"  value={`${fmt(finalScore)}%`} tone={finalScore >= 80 ? 'green' : finalScore >= 60 ? 'amber' : 'red'} />
      </div>

      {/* المؤشرات الست — رادار + أشرطة */}
      <div className="rounded-2xl border border-border bg-slate-50 p-4">
        <h4 className="mb-4 font-extrabold text-text-main">المؤشرات الست التفصيلية</h4>

        {/* Radar Chart */}
        <div className="mb-4 overflow-hidden rounded-xl border border-border bg-white">
          <RadarKPI data={indicators.map((ind) => ({
            subject: ind.label.split(' ')[0],
            score: Number(ind.score) || 0,
            fullMark: 100,
          }))} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {indicators.map((ind) => (
            <ScoreBar key={ind.label} label={ind.label} score={ind.score} weight={ind.weight} />
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-text-main">الدرجة الكلية</span>
            <span className={`text-xl font-extrabold ${scoreTone(finalScore)}`}>{fmt(finalScore)}%</span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full transition-all duration-700 ${scoreColor(finalScore)}`} style={{ width: `${finalScore}%` }} />
          </div>
        </div>
      </div>

      {/* الرؤى الذكية */}
      {s.insights?.length > 0 && (
        <div>
          <h4 className="mb-3 font-extrabold text-text-main">الرؤى والتوصيات</h4>
          <div className="space-y-2">
            {s.insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${INSIGHT_BG[ins.type] || INSIGHT_BG.info}`}>
                <span className="mt-0.5 shrink-0 text-base">{INSIGHT_ICON[ins.type] || 'ℹ️'}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تفصيل حسب نوع العنصر */}
      {s.elementBreakdown?.length > 0 && (
        <div>
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-text-main hover:bg-slate-100"
          >
            <span>تفصيل الأداء حسب نوع عنصر الإقفال ({s.elementBreakdown.length} عنصر)</span>
            <span className="text-text-soft">{showBreakdown ? '▲' : '▼'}</span>
          </button>

          {showBreakdown && (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-background text-text-soft">
                  <tr>
                    <th className="px-3 py-2 text-right font-bold">العنصر</th>
                    <th className="px-3 py-2 text-right font-bold">المطلوب</th>
                    <th className="px-3 py-2 text-right font-bold">مُقدَّم</th>
                    <th className="px-3 py-2 text-right font-bold">مقبول</th>
                    <th className="px-3 py-2 text-right font-bold">مُعاد</th>
                    <th className="px-3 py-2 text-right font-bold">مرفوض</th>
                    <th className="px-3 py-2 text-right font-bold">نسبة القبول</th>
                    <th className="px-3 py-2 text-right font-bold">متوسط التقديم</th>
                  </tr>
                </thead>
                <tbody>
                  {s.elementBreakdown.map((el) => (
                    <tr key={el.key} className="border-t border-border hover:bg-background">
                      <td className="px-3 py-2 font-bold text-text-main">{el.name}</td>
                      <td className="px-3 py-2 text-center">{el.total}</td>
                      <td className="px-3 py-2 text-center">{el.submitted}</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600">{el.approved}</td>
                      <td className="px-3 py-2 text-center font-bold text-amber-600">{el.returned}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-500">{el.rejected}</td>
                      <td className="px-3 py-2">
                        <Badge tone={el.approvalRate >= 80 ? 'green' : el.approvalRate >= 60 ? 'amber' : 'red'}>
                          {fmt(el.approvalRate)}%
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-text-soft">
                        {el.avgSubmissionHours > 0 ? `${fmt(el.avgSubmissionHours)} ساعة` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* مؤشر الاتجاه */}
      {!loadingTrend && trend?.trend?.length >= 2 && (
        <div>
          <h4 className="mb-3 font-extrabold text-text-main">
            الاتجاه خلال {trend.periodsCount} فترات
            {trend.summary?.direction === 'improving' && <span className="mr-2 text-sm text-emerald-600">▲ في تحسن</span>}
            {trend.summary?.direction === 'declining' && <span className="mr-2 text-sm text-red-500">▼ في تراجع</span>}
            {trend.summary?.direction === 'stable'    && <span className="mr-2 text-sm text-text-soft">← مستقر</span>}
          </h4>
          <div className="flex items-end gap-1.5 overflow-x-auto rounded-2xl border border-border bg-slate-50 p-4">
            {trend.trend.map((t, i) => {
              const h = Math.max(8, Math.round((Number(t.finalScore) / 100) * 80));
              const isLast = i === trend.trend.length - 1;
              return (
                <div key={t.periodLabel} className="flex min-w-[52px] flex-col items-center gap-1">
                  <span className={`text-xs font-bold ${scoreTone(t.finalScore)}`}>{fmt(t.finalScore)}</span>
                  <div className="w-8 overflow-hidden rounded-t-md" style={{ height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${scoreColor(t.finalScore)} ${isLast ? 'opacity-100' : 'opacity-60'}`}
                      style={{ height: `${h}px` }}
                    />
                  </div>
                  <span className="text-center text-[10px] text-text-soft leading-tight">{t.periodLabel}</span>
                  {t.delta && (
                    <span className={`text-[10px] font-bold ${t.delta.finalScore > 0 ? 'text-emerald-600' : t.delta.finalScore < 0 ? 'text-red-500' : 'text-text-soft'}`}>
                      {t.delta.finalScore > 0 ? `+${fmt(t.delta.finalScore)}` : fmt(t.delta.finalScore)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-text-soft">
            <span>أعلى: {fmt(trend.summary?.bestScore)}%</span>
            <span>أدنى: {fmt(trend.summary?.worstScore)}%</span>
            <span>متوسط: {fmt(trend.summary?.avgScore)}%</span>
          </div>
        </div>
      )}

      {/* المؤشرات التفصيلية الأرقام */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <h4 className="mb-3 font-extrabold text-text-main">الأرقام التفصيلية — العناصر</h4>
          <div className="space-y-1.5 text-sm">
            {[
              ['المطلوبة', s.requiredElementsCount],
              ['المكتملة', s.completedElementsCount],
              ['المقدمة', s.submittedElementsCount],
              ['المعتمدة', s.approvedElementsCount],
              ['المعادة', s.returnedElementsCount],
              ['المرفوضة', s.rejectedElementsCount],
              ['معدل الإعادة', `${fmt(s.returnRate)}%`],
              ['معدل الرفض', `${fmt(s.rejectRate)}%`],
              ['قبول من أول مرة', `${fmt(s.firstPassApprovalRate)}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-1">
                <span className="text-text-soft">{k}</span>
                <span className="font-bold text-text-main">{v ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <h4 className="mb-3 font-extrabold text-text-main">الأرقام التفصيلية — السرعة والانضباط</h4>
          <div className="space-y-1.5 text-sm">
            {[
              ['متوسط تقديم العنصر', `${fmt(s.avgElementSubmissionHours)} ساعة`],
              ['متوسط إعادة التقديم', `${fmt(s.avgResubmissionHours)} ساعة`],
              ['متوسط تأخر إقفال الدورة', `${fmt(s.avgCourseClosureDelayDays)} يوم`],
              ['عناصر متأخرة', `${s.overdueElementsCount} (${fmt(s.overdueElementsRate)}%)`],
              ['عناصر راكدة', `${s.stalePendingElementsCount} (${fmt(s.stalePendingElementsRate)}%)`],
              ['دورات متأخرة', `${s.overdueCoursesCount} (${fmt(s.overdueCoursesRate)}%)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-1">
                <span className="text-text-soft">{k}</span>
                <span className="font-bold text-text-main">{v ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ملاحظات المدير */}
      {isManager && (
        <div className="space-y-3 rounded-2xl border border-border bg-blue-50/30 p-4">
          <h4 className="font-extrabold text-text-main">إضافة ملاحظة إدارية</h4>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[90px] w-full rounded-2xl border border-border bg-white p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="اكتب ملاحظة مهنية عن أداء المستخدم في هذه الفترة..."
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="rounded-2xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {savingNote ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
            </button>
          </div>
        </div>
      )}

      {/* الملاحظات المحفوظة */}
      {s.notes?.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-extrabold text-text-main">الملاحظات الإدارية السابقة</h4>
          {s.notes.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-background p-3">
              <p className="text-sm text-text-main">{item.note}</p>
              <p className="mt-2 text-xs text-text-soft">
                {item.manager?.firstName} {item.manager?.lastName} —{' '}
                {new Date(item.createdAt).toLocaleString('ar-SA')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================================================================
// الصفحة الرئيسية
// ======================================================================

export default function KpisPage() {
  const currentYear = new Date().getFullYear();
  const { activeRole } = useAuth();
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isManager = activeRole === 'MANAGER';

  const [periodType, setPeriodType] = useState('MONTHLY');
  const [year, setYear] = useState(currentYear);
  const [value, setValue] = useState(new Date().getMonth() + 1);

  const [loadingCalc, setLoadingCalc]         = useState(false);
  const [loadingSnap, setLoadingSnap]         = useState(false);
  const [loadingAssign, setLoadingAssign]     = useState(false);
  const [savingAssign, setSavingAssign]       = useState({});
  const [showAssignReg, setShowAssignReg]     = useState(false);

  const [snapshots, setSnapshots]             = useState([]);
  const [assignRows, setAssignRows]           = useState([]);
  const [selectedId, setSelectedId]           = useState(null);
  const [selectedSnap, setSelectedSnap]       = useState(null);
  const [loadingDetail, setLoadingDetail]     = useState(false);

  const periodLabel = useMemo(() => {
    if (periodType === 'MONTHLY')   return `${year}-${String(value).padStart(2, '0')}`;
    if (periodType === 'QUARTERLY') return `${year}-Q${value}`;
    return `${year}`;
  }, [periodType, year, value]);

  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);

  const inputCls = 'border border-border rounded-2xl px-3 py-2.5 text-sm bg-white text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  // ---- جلب البيانات ----

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnap(true);
    try {
      const res = await api.get('/kpis', { params: { periodType, periodLabel } });
      setSnapshots(res.data || []);
    } catch { toast.error('تعذر تحميل مؤشرات الأداء'); }
    finally { setLoadingSnap(false); }
  }, [periodType, periodLabel]);

  const fetchAssignments = useCallback(async () => {
    setLoadingAssign(true);
    try {
      const res = await api.get('/kpis/assignments', {
        params: { periodType, year: Number(year), value: periodType === 'YEARLY' ? undefined : Number(value) },
      });
      setAssignRows((res.data?.rows || []).map((r) => ({
        ...r,
        assignedInput: r.assignedCoursesCount == null ? '' : String(r.assignedCoursesCount),
        notesInput: r.notes || '',
      })));
    } catch { toast.error('تعذر تحميل سجل الإسناد'); }
    finally { setLoadingAssign(false); }
  }, [periodType, year, value]);

  useEffect(() => {
    fetchSnapshots();
    fetchAssignments();
    setSelectedId(null);
    setSelectedSnap(null);
  }, [fetchSnapshots, fetchAssignments]);

  // ---- الاحتساب ----

  const handleCalculate = async () => {
    if (!isManager) return;
    setLoadingCalc(true);
    try {
      await api.post('/kpis/calculate', { periodType, year: Number(year), value: periodType === 'YEARLY' ? undefined : Number(value) });
      toast.success('تم احتساب المؤشرات');
      await fetchSnapshots();
    } catch (err) { toast.error(err.response?.data?.message || 'تعذر الاحتساب'); }
    finally { setLoadingCalc(false); }
  };

  // ---- التفاصيل ----

  const handleOpenDetails = async (snap) => {
    if (selectedId === snap.userId) { setSelectedId(null); setSelectedSnap(null); return; }
    setSelectedId(snap.userId);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/kpis/${snap.userId}/${snap.periodType}/${snap.periodLabel}`);
      setSelectedSnap(res.data);
    } catch { toast.error('تعذر تحميل التفاصيل'); setSelectedId(null); }
    finally { setLoadingDetail(false); }
  };

  const handleNoteAdded = async () => {
    if (!selectedSnap) return;
    const res = await api.get(`/kpis/${selectedSnap.userId}/${selectedSnap.periodType}/${selectedSnap.periodLabel}`).catch(() => null);
    if (res) setSelectedSnap(res.data);
  };

  // ---- الإسناد ----

  const updateAssignRow = (userId, field, val) =>
    setAssignRows((prev) => prev.map((r) => r.userId === userId ? { ...r, [field]: val } : r));

  const handleSaveAssign = async (row) => {
    const count = Number(String(row.assignedInput).trim());
    if (isNaN(count) || count < 0) { toast.error('أدخل عدداً صحيحاً'); return; }
    setSavingAssign((p) => ({ ...p, [row.userId]: true }));
    try {
      await api.post('/kpis/assignments', {
        userId: row.userId, periodType,
        year: Number(year), value: periodType === 'YEARLY' ? undefined : Number(value),
        assignedCoursesCount: count, notes: row.notesInput || '',
      });
      toast.success(`حُفظ إسناد ${row.employeeName}`);
      fetchAssignments();
      fetchSnapshots();
    } catch (err) { toast.error(err.response?.data?.message || 'تعذر الحفظ'); }
    finally { setSavingAssign((p) => ({ ...p, [row.userId]: false })); }
  };

  // ---- الإجماليات ----

  const totals = useMemo(() => ({
    assigned: assignRows.reduce((s, r) => s + Number(r.assignedCoursesCount || 0), 0),
    actual:   assignRows.reduce((s, r) => s + Number(r.actualCoursesCount || 0), 0),
    missing:  assignRows.reduce((s, r) => s + Number(r.missingCoursesCount || 0), 0),
  }), [assignRows]);

  const topSnap = snapshots[0];
  const lowSnap = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const avgScore = snapshots.length
    ? fmt(snapshots.reduce((s, x) => s + Number(x.finalScore || 0), 0) / snapshots.length)
    : '-';

  // ======================================================================
  // عرض
  // ======================================================================

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* رأس الصفحة + فلاتر الفترة */}
        <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">مؤشرات الأداء</h1>
              <p className="mt-1 text-sm text-text-soft">
                {isSupervisor
                  ? 'متابعة أداء موظفي المشروع — 6 مؤشرات مفصلة لكل موظف'
                  : 'إدارة الإسناد وقياس الأداء بـ 6 مؤشرات ذكية مرتبطة بمواعيد العناصر'}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-soft">نوع الفترة</label>
                <select value={periodType} onChange={(e) => { setPeriodType(e.target.value); setValue(1); }} className={inputCls}>
                  {PERIOD_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-soft">السنة</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {periodType === 'MONTHLY' && (
                <div>
                  <label className="mb-1 block text-xs text-text-soft">الشهر</label>
                  <select value={value} onChange={(e) => setValue(Number(e.target.value))} className={inputCls}>
                    {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              )}
              {periodType === 'QUARTERLY' && (
                <div>
                  <label className="mb-1 block text-xs text-text-soft">الربع</label>
                  <select value={value} onChange={(e) => setValue(Number(e.target.value))} className={inputCls}>
                    {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                  </select>
                </div>
              )}
              {isManager && (
                <button onClick={handleCalculate} disabled={loadingCalc}
                  className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                  {loadingCalc ? 'جاري الاحتساب...' : '⚙ احتساب المؤشرات'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* بطاقات ملخص المؤشرات */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard title="الدورات المسندة إجمالاً" value={totals.assigned} />
          <SummaryCard title="الدورات الفعلية إجمالاً" value={totals.actual} />
          <SummaryCard title="فجوة التسجيل" value={totals.missing}
            tone={totals.missing > 0 ? 'red' : 'green'}
            sub={totals.missing > 0 ? 'دورات مسندة غير مسجلة' : 'لا توجد فجوة'} />
          <SummaryCard title="متوسط الدرجة النهائية" value={`${avgScore}%`}
            tone={Number(avgScore) >= 80 ? 'green' : Number(avgScore) >= 60 ? 'amber' : 'red'} />
        </div>

        {/* سجل الإسناد — مخفي بالافتراض */}
        {isManager && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <button
              onClick={() => setShowAssignReg(v => !v)}
              className="flex w-full items-center justify-between px-5 py-4 hover:bg-background transition">
              <div className="flex items-center gap-3 text-right">
                <span className="text-base">📋</span>
                <div>
                  <h2 className="font-extrabold text-text-main">سجل الإسناد التخطيطي</h2>
                  <p className="text-xs text-text-soft">
                    {showAssignReg ? 'لتحديد العدد المخطط للدورات لكل موظف (اختياري — لا يؤثر على KPI إذا لم يُعبأ)' : 'اضغط لإدارة العدد المخطط للدورات لكل موظف'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="gray">{periodLabel}</Badge>
                <span className="text-xs text-text-soft">{showAssignReg ? '▲ إخفاء' : '▼ إظهار'}</span>
              </div>
            </button>

            {!showAssignReg && (
              <div className="border-t border-border bg-amber-50/30 px-5 py-3 text-xs text-amber-700">
                💡 <strong>ملاحظة:</strong> هذا السجل مخصص للتخطيط المسبق فقط. إذا لم تكن لديك خطة مسندة رسمية قبل الدورات، يمكن تجاهله — مؤشرات KPI تعمل بالكامل على الدورات الفعلية في النظام.
              </div>
            )}

            {showAssignReg && <div className="border-t border-border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['الموظف', 'الفعلي', 'المسند', 'التغطية', 'ملاحظات', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingAssign ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-text-soft">جاري التحميل...</td></tr>
                  ) : assignRows.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-text-soft">لا توجد بيانات</td></tr>
                  ) : assignRows.map((row) => (
                    <tr key={row.userId} className="border-t border-border hover:bg-background">
                      <td className="px-4 py-3">
                        <div className="font-bold">{row.employeeName}</div>
                        <div className="text-xs text-text-soft">{row.projectName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-extrabold text-primary">{row.actualCoursesCount}</span>
                        {row.missingCoursesCount > 0 && <div className="text-xs text-red-500">ناقص {row.missingCoursesCount}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" value={row.assignedInput}
                          onChange={(e) => updateAssignRow(row.userId, 'assignedInput', e.target.value)}
                          className="w-24 rounded-xl border border-border px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={Number(row.courseRegistrationCoverageRate) >= 100 ? 'green' : Number(row.courseRegistrationCoverageRate) >= 80 ? 'amber' : 'red'}>
                          {fmt(row.courseRegistrationCoverageRate)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <input value={row.notesInput} onChange={(e) => updateAssignRow(row.userId, 'notesInput', e.target.value)}
                          className="w-40 rounded-xl border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
                          placeholder="ملاحظة" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleSaveAssign(row)} disabled={!!savingAssign[row.userId]}
                          className="rounded-2xl bg-primary px-4 py-1.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                          {savingAssign[row.userId] ? '...' : 'حفظ'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>}  {/* نهاية showAssignReg */}
          </div>
        )}

        {/* بطاقات أفضل وأضعف أداء */}
        {snapshots.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard title="الأعلى أداءً" tone="green"
              value={`${topSnap?.user?.firstName || ''} ${topSnap?.user?.lastName || ''}`}
              sub={`الدرجة: ${fmt(topSnap?.finalScore)}% — ${topSnap?.performanceLevelLabel || ''}`} />
            <SummaryCard title="عدد الموظفين المُقيَّمين" value={snapshots.length} />
            <SummaryCard title="يحتاج متابعة" tone={Number(lowSnap?.finalScore) < 60 ? 'red' : 'amber'}
              value={`${lowSnap?.user?.firstName || ''} ${lowSnap?.user?.lastName || ''}`}
              sub={`الدرجة: ${fmt(lowSnap?.finalScore)}% — ${lowSnap?.performanceLevelLabel || ''}`} />
          </div>
        )}

        {/* رسم مقارنة الفريق */}
        {snapshots.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-extrabold text-text-main">مقارنة أداء الفريق</h3>
              <p className="mt-0.5 text-xs text-text-soft">الدرجة الكلية لكل موظف — أخضر ≥ 80% / أصفر ≥ 60% / أحمر &lt; 60%</p>
            </div>
            <div className="p-4">
              <TeamBarChart data={snapshots
                .filter((s) => s.isSubjectToEvaluation && s.finalScoreDisplay != null)
                .map((s) => ({
                  name: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim(),
                  score: Number(s.finalScoreDisplay || s.finalScore || 0),
                }))} />
            </div>
          </div>
        )}

        {/* جدول نتائج الموظفين */}
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-primary">نتائج الأداء</h2>
              <p className="mt-1 text-sm text-text-soft">اضغط على «التفاصيل» لعرض المؤشرات الست والرؤى والاتجاه</p>
            </div>
            <Badge tone="gray">{periodLabel}</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background text-text-soft">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">الموظف</th>
                  <th className="px-4 py-3 text-right font-bold">المشروع</th>
                  <th className="px-4 py-3 text-right font-bold">الدرجة</th>
                  <th className="px-4 py-3 text-right font-bold">الإنتاج</th>
                  <th className="px-4 py-3 text-right font-bold">الجودة</th>
                  <th className="px-4 py-3 text-right font-bold">التصنيف</th>
                  <th className="px-4 py-3 text-right font-bold">الإنجاز</th>
                  <th className="px-4 py-3 text-right font-bold">الالتزام</th>
                  <th className="px-4 py-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {loadingSnap ? (
                  <tr><td colSpan="9" className="px-4 py-10 text-center text-text-soft">جاري التحميل...</td></tr>
                ) : snapshots.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-10 text-center text-text-soft">
                      لا توجد نتائج — اضغط «احتساب المؤشرات» لبدء الاحتساب
                    </td>
                  </tr>
                ) : snapshots.map((item) => {
                  const score = Number(item.finalScore) || 0;
                  const isSelected = selectedId === item.userId;
                  return (
                    <tr key={item.id || item.userId}
                      className={`border-t border-border transition ${isSelected ? 'bg-primary-light/30' : 'hover:bg-background'}`}>
                      <td className="px-4 py-3 font-bold text-text-main">
                        {item.user?.firstName} {item.user?.lastName}
                      </td>
                      <td className="px-4 py-3 text-text-soft">{item.user?.operationalProject?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-lg font-extrabold ${scoreTone(score)}`}>{fmt(score)}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${scoreColor(item.productivityScore)}`} style={{ width: `${item.productivityScore}%` }} />
                          </div>
                          <span className="text-xs text-text-soft">{fmt(item.productivityScore)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${scoreColor(item.qualityScore)}`} style={{ width: `${item.qualityScore}%` }} />
                          </div>
                          <span className="text-xs text-text-soft">{fmt(item.qualityScore)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={LEVEL_TONE[item.performanceLevel] || 'gray'}>
                          {item.performanceLevelLabel || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={item.closureCompletionRate >= 80 ? 'green' : item.closureCompletionRate >= 60 ? 'amber' : 'red'}>
                          {fmt(item.closureCompletionRate)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={item.commitmentStatus === 'COMMITTED' ? 'green' : item.commitmentStatus === 'NOT_COMMITTED' ? 'red' : 'amber'}>
                          {item.commitmentStatusLabel || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleOpenDetails(item)}
                          className={`rounded-2xl border px-3 py-1.5 text-sm font-bold transition ${isSelected ? 'border-primary bg-primary text-white' : 'border-primary text-primary hover:bg-primary-light'}`}>
                          {isSelected ? 'إغلاق' : 'التفاصيل'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* لوح التفاصيل */}
        {loadingDetail && (
          <div className="rounded-3xl border border-border bg-white p-10 text-center text-text-soft shadow-card">
            جاري تحميل التفاصيل...
          </div>
        )}
        {!loadingDetail && selectedSnap && (
          <SnapshotDetails
            snapshot={selectedSnap}
            isManager={isManager}
            onNoteAdded={handleNoteAdded}
          />
        )}

      </div>
    </MainLayout>
  );
}
