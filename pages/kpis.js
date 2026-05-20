import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const RadarKPI     = dynamic(() => import('../components/charts/RadarKPI'),     { ssr: false });
const TeamBarChart = dynamic(() => import('../components/charts/TeamBarChart'), { ssr: false });

// ─── أدوات ────────────────────────────────────────────────────

function fmt(v, d = 1) {
  if (v == null) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

function fmtRelative(v) {
  if (!v) return '-';
  const d = (Date.now() - new Date(v).getTime()) / 3600000;
  if (d < 24)  return `منذ ${Math.round(d)} ساعة`;
  if (d < 168) return `منذ ${Math.floor(d/24)} يوم`;
  return new Date(v).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const LEVEL_CFG = {
  OUTSTANDING:      { label:'متميز',         color:'#253C32', bg:'bg-forest-50',    border:'border-forest-400/40', text:'text-primary',      ring:'#253C32' },
  VERY_GOOD:        { label:'جيد جداً',       color:'#394F49', bg:'bg-primary-light',border:'border-forest-400/30', text:'text-forest-500',   ring:'#394F49' },
  GOOD:             { label:'جيد',           color:'#4B5952', bg:'bg-forest-100',   border:'border-forest-200',    text:'text-slate-g',      ring:'#4B5952' },
  NEEDS_IMPROVEMENT:{ label:'يحتاج تحسين',   color:'#8B7D6B', bg:'bg-sand/20',      border:'border-sand/50',       text:'text-warning',      ring:'#C3B39F' },
  WEAK:             { label:'ضعيف',          color:'#633646', bg:'bg-burgundy/10',  border:'border-burgundy/30',   text:'text-danger',       ring:'#633646' },
};

const IND_CFG = [
  { key:'productivityScore',    icon:'📦', label:'الإنتاجية',   weight:25, tip:'إتمام عناصر الإقفال من المطلوبة' },
  { key:'timelinessScore',      icon:'🕐', label:'التوقيت',     weight:20, tip:'الالتزام بمواعيد تقديم العناصر' },
  { key:'qualityScore',         icon:'⭐', label:'الجودة',      weight:20, tip:'نسبة القبول من أول مرة' },
  { key:'criticalScore',        icon:'🎯', label:'العناصر الحرجة',weight:20, tip:'التقريران والمستحقات والتسوية' },
  { key:'speedScore',           icon:'⚡', label:'الاستجابة',   weight:10, tip:'سرعة إعادة التقديم بعد الإعادة' },
  { key:'disciplineScore',      icon:'🛡️', label:'الانضباط',    weight:5,  tip:'غياب الركود والتأخر' },
];

const INSIGHT_ICON = { positive:'✅', warning:'⚠️', critical:'🔴', info:'ℹ️' };
const INSIGHT_BG   = { positive:'bg-emerald-50 border-emerald-200 text-emerald-800', warning:'bg-amber-50 border-amber-200 text-amber-800', critical:'bg-red-50 border-red-200 text-red-700', info:'bg-blue-50 border-blue-200 text-blue-800' };

// ─── مكوّن قياس دائري SVG ────────────────────────────────────

function CircleGauge({ score, size = 88 }) {
  const s   = Math.min(100, Math.max(0, Number(score) || 0));
  const r   = (size - 12) / 2;
  const c   = 2 * Math.PI * r;
  const off = c - (s / 100) * c;
  const level = s >= 80 ? 'OUTSTANDING' : s >= 70 ? 'VERY_GOOD' : s >= 60 ? 'GOOD' : s >= 50 ? 'NEEDS_IMPROVEMENT' : 'WEAK';
  const clr = LEVEL_CFG[level]?.ring || '#9DA3A1';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#D7DBDA" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth={8}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="absolute text-base font-extrabold" style={{ color: clr, fontSize: size < 70 ? '0.65rem' : '0.85rem' }}>
        {s > 0 ? `${Math.round(s)}%` : '-'}
      </span>
    </div>
  );
}

// ─── مكوّن Tooltip ───────────────────────────────────────────

function Tip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative">
      <button type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500 hover:bg-primary/20 hover:text-primary">?</button>
      {show && (
        <span className="absolute bottom-full right-0 z-50 mb-1 w-48 rounded-xl border border-border bg-white p-2 text-[11px] leading-relaxed text-text-main shadow-soft">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── بطاقة موظف ──────────────────────────────────────────────

function EmployeeCard({ snap, selected, onSelect, isManager }) {
  const s     = snap;
  const score = Number(s.finalScoreDisplay ?? s.finalScore ?? 0);
  const level = s.performanceLevel || 'GOOD';
  const lcfg  = LEVEL_CFG[level] || LEVEL_CFG.GOOD;
  const name  = `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim();
  const proj  = s.user?.operationalProject?.name || '-';
  const noData = !s.isSubjectToEvaluation;

  return (
    <div
      onClick={() => onSelect(s)}
      className={`group cursor-pointer rounded-2xl border bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft
        ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}
    >
      {/* الاسم والمشروع */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${noData ? 'bg-slate-300' : 'bg-primary'}`}>
            {name[0]}{name.split(' ')[1]?.[0] || ''}
          </div>
          <div className="min-w-0">
            <p className="truncate font-extrabold text-sm text-text-main">{name}</p>
            <p className="truncate text-[10px] text-text-soft">{proj}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${lcfg.bg} ${lcfg.border} ${lcfg.text}`}>
          {noData ? 'بدون بيانات' : lcfg.label}
        </span>
      </div>

      {/* القياس الدائري */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <CircleGauge score={noData ? 0 : score} size={80} />
        <div className="flex-1 space-y-1.5">
          {IND_CFG.slice(0, 3).map((ind) => {
            const val = Math.min(100, Math.max(0, Number(s[ind.key]) || 0));
            return (
              <div key={ind.key}>
                <div className="mb-0.5 flex items-center justify-between text-[10px]">
                  <span className="text-text-soft">{ind.icon} {ind.label}</span>
                  <span className={`font-bold ${val >= 80 ? 'text-success' : val >= 60 ? 'text-warning' : 'text-danger'}`}>{noData ? '-' : `${Math.round(val)}%`}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all duration-500 ${val >= 80 ? 'bg-accent' : val >= 60 ? 'bg-sand' : 'bg-burgundy'}`} style={{ width: noData ? '0%' : `${val}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* شارتَا الالتزام والانضباط */}
      <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
        {[
          { key:'commitmentStatusLabel',  bg:'bg-slate-50', val:s.commitmentStatusLabel  },
          { key:'disciplineStatusLabel',  bg:'bg-slate-50', val:s.disciplineStatusLabel  },
        ].map((b) => b.val && (
          <span key={b.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{b.val}</span>
        ))}
        <span className="mr-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {s.actualCoursesCount ?? 0} دورة
        </span>
      </div>

      <div className="mt-2 text-center">
        <span className={`text-[10px] font-bold ${selected ? 'text-primary' : 'text-text-soft group-hover:text-primary'}`}>
          {selected ? '▲ إغلاق التفاصيل' : '▼ عرض التفاصيل'}
        </span>
      </div>
    </div>
  );
}

// ─── لوح تفاصيل الموظف ───────────────────────────────────────

function DetailsPanel({ snap, isManager, onClose, onNoteAdded }) {
  const [note, setNote]           = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [trend, setTrend]         = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const s = snap;

  useEffect(() => {
    if (!s?.userId) return;
    api.get(`/kpis/trend/${s.userId}`, { params: { periodType: s.periodType, periodsCount: 6 } })
      .then(r => setTrend(r.data)).catch(() => {});
  }, [s?.userId, s?.periodType]);

  const handleNote = async () => {
    if (!note.trim()) { toast.error('اكتب الملاحظة أولاً'); return; }
    setSavingNote(true);
    try {
      await api.post(`/kpis/${s.id}/notes`, { userId: s.userId, note: note.trim() });
      toast.success('تم حفظ الملاحظة ✓');
      setNote('');
      onNoteAdded?.();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الحفظ'); }
    finally { setSavingNote(false); }
  };

  const score = Number(s.finalScoreDisplay ?? s.finalScore ?? 0);
  const level = s.performanceLevel || 'GOOD';
  const lcfg  = LEVEL_CFG[level] || LEVEL_CFG.GOOD;

  const radarData = IND_CFG.map(ind => ({
    subject: ind.label,
    score: Math.min(100, Number(s[ind.key]) || 0),
    fullMark: 100,
  }));

  return (
    <div className="rounded-2xl border border-primary/20 bg-white shadow-soft overflow-hidden">
      {/* رأس */}
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-primary/5 to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <CircleGauge score={score} size={56} />
          <div>
            <h3 className="font-extrabold text-text-main">{s.user?.firstName} {s.user?.lastName}</h3>
            <p className="text-xs text-text-soft">{s.user?.operationalProject?.name} — {s.periodLabel}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${lcfg.bg} ${lcfg.border} ${lcfg.text}`}>{lcfg.label}</span>
        </div>
        <button onClick={onClose} className="rounded-xl border border-border px-3 py-1.5 text-xs text-text-soft hover:bg-background">✕ إغلاق</button>
      </div>

      <div className="p-5 space-y-5">
        {/* بطاقات ملخص */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label:'الدرجة الكلية',   val:`${fmt(score)}%`, color: score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger' },
            { label:'إتمام العناصر',   val:`${fmt(s.closureCompletionRate)}%`, color:'text-primary' },
            { label:'الدورات الفعلية', val: s.actualCoursesCount ?? 0, color:'text-text-main' },
            { label:'عناصر متأخرة',   val: s.overdueElementsCount ?? 0, color: (s.overdueElementsCount > 0) ? 'text-danger' : 'text-success' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-[10px] text-text-soft">{c.label}</p>
              <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* المؤشرات الست */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Radar */}
          <div className="rounded-xl border border-border bg-slate-50 p-3">
            <h4 className="mb-2 text-xs font-extrabold text-text-soft uppercase">خريطة المؤشرات</h4>
            <RadarKPI data={radarData} />
          </div>

          {/* Bars */}
          <div className="rounded-xl border border-border bg-slate-50 p-3">
            <h4 className="mb-3 text-xs font-extrabold text-text-soft uppercase">تفصيل المؤشرات</h4>
            <div className="space-y-2.5">
              {IND_CFG.map(ind => {
                const val = Math.min(100, Math.max(0, Number(s[ind.key]) || 0));
                return (
                  <div key={ind.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-text-main font-medium">
                        <span>{ind.icon}</span>{ind.label}
                        <Tip text={ind.tip} />
                        <span className="text-[9px] text-text-soft">({ind.weight}%)</span>
                      </span>
                      <span className={`font-extrabold ${val >= 80 ? 'text-success' : val >= 60 ? 'text-warning' : 'text-danger'}`}>{fmt(val)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full transition-all duration-700 ${val >= 80 ? 'bg-accent' : val >= 60 ? 'bg-sand' : 'bg-burgundy'}`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* الرؤى */}
        {s.insights?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-extrabold uppercase text-text-soft">رؤى تلقائية</h4>
            <div className="space-y-1.5">
              {s.insights.map((ins, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs ${INSIGHT_BG[ins.type] || INSIGHT_BG.info}`}>
                  <span className="shrink-0">{INSIGHT_ICON[ins.type] || 'ℹ️'}</span>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الاتجاه */}
        {trend?.trend?.length >= 2 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-xs font-extrabold uppercase text-text-soft">الاتجاه عبر الفترات</h4>
              <span className={`text-[10px] font-bold ${trend.summary?.direction === 'improving' ? 'text-success' : trend.summary?.direction === 'declining' ? 'text-danger' : 'text-text-soft'}`}>
                {trend.summary?.direction === 'improving' ? '▲ تحسن' : trend.summary?.direction === 'declining' ? '▼ تراجع' : '← مستقر'}
              </span>
            </div>
            <div className="flex items-end gap-1.5 overflow-x-auto rounded-xl border border-border bg-slate-50 p-3">
              {trend.trend.map((t, i) => {
                const h = Math.max(6, Math.round((Number(t.finalScore) / 100) * 64));
                const val = Number(t.finalScore) || 0;
                const clr = val >= 80 ? 'bg-accent' : val >= 60 ? 'bg-sand' : 'bg-burgundy';
                return (
                  <div key={t.periodLabel} className="flex min-w-[44px] flex-col items-center gap-0.5">
                    <span className={`text-[9px] font-bold ${val >= 80 ? 'text-success' : val >= 60 ? 'text-warning' : 'text-danger'}`}>{Math.round(val)}%</span>
                    <div className="w-7 overflow-hidden rounded-t-md" style={{ height:64, display:'flex', alignItems:'flex-end' }}>
                      <div className={`w-full rounded-t-md ${clr} ${i === trend.trend.length-1 ? 'opacity-100' : 'opacity-50'}`} style={{ height: h }} />
                    </div>
                    <span className="text-center text-[9px] text-text-soft leading-tight">{t.periodLabel?.slice(-5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* تفصيل العناصر */}
        {s.elementBreakdown?.length > 0 && (
          <div>
            <button onClick={() => setShowBreakdown(v => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-text-main hover:bg-slate-100">
              <span>📋 تفصيل الأداء حسب نوع العنصر ({s.elementBreakdown.length})</span>
              <span className="text-text-soft">{showBreakdown ? '▲' : '▼'}</span>
            </button>
            {showBreakdown && (
              <div className="mt-1.5 overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-xs">
                  <thead className="bg-background text-text-soft">
                    <tr>
                      {['العنصر','المطلوب','قُبل','أُعيد','القبول من أول مرة','متوسط التقديم'].map(h => (
                        <th key={h} className="px-3 py-2 text-right font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.elementBreakdown.map(el => (
                      <tr key={el.key} className="border-t border-border hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-text-main">{el.name}</td>
                        <td className="px-3 py-2 text-center">{el.total}</td>
                        <td className="px-3 py-2 text-center font-bold text-success">{el.approved}</td>
                        <td className="px-3 py-2 text-center font-bold text-warning">{el.returned}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${el.approvalRate >= 80 ? 'bg-emerald-50 text-success' : el.approvalRate >= 60 ? 'bg-amber-50 text-warning' : 'bg-red-50 text-danger'}`}>
                            {fmt(el.approvalRate)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-soft">{el.avgSubmissionHours > 0 ? `${fmt(el.avgSubmissionHours)} ساعة` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ملاحظة المدير */}
        {isManager && (
          <div className="rounded-xl border border-primary/20 bg-primary-light/30 p-3">
            <h4 className="mb-2 text-xs font-extrabold text-primary">✏️ ملاحظة إدارية</h4>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="اكتب ملاحظة للموظف عن أدائه هذه الفترة..."
              className="w-full resize-none rounded-lg border border-border bg-white p-2 text-xs outline-none focus:border-primary" />
            <div className="mt-1.5 flex justify-end">
              <button onClick={handleNote} disabled={savingNote}
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                {savingNote ? '...' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {/* الملاحظات السابقة */}
        {s.notes?.length > 0 && (
          <div className="space-y-1.5">
            {s.notes.map(n => (
              <div key={n.id} className="rounded-xl border border-border bg-background p-2.5">
                <p className="text-xs text-text-main">{n.note}</p>
                <p className="mt-1 text-[10px] text-text-soft">{n.manager?.firstName} {n.manager?.lastName} — {fmtRelative(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────

export default function KpisPage() {
  const { activeRole } = useAuth();
  const isManager    = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const periodLabel = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);

  const [snapshots,   setSnapshots]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedId,  setSelectedId]  = useState(null);
  const [selectedSnap,setSelectedSnap]= useState(null);
  const [loadingDet,  setLoadingDet]  = useState(false);
  const [lastCalc,    setLastCalc]    = useState(null);

  // جلب اللقطات
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/kpis', { params: { periodType: 'MONTHLY', periodLabel } });
      const data = res.data || [];
      setSnapshots(data);
      if (data.length) setLastCalc(data[0]?.updatedAt || data[0]?.createdAt);
    } catch { setSnapshots([]); }
    finally { setLoading(false); }
  }, [periodLabel]);

  useEffect(() => { load(); setSelectedId(null); setSelectedSnap(null); }, [load]);

  // احتساب المؤشرات
  const calculate = async () => {
    if (!isManager) return;
    setCalculating(true);
    try {
      await api.post('/kpis/calculate', { periodType: 'MONTHLY', year, value: month });
      toast.success('✓ تم احتساب المؤشرات');
      await load();
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الاحتساب'); }
    finally { setCalculating(false); }
  };

  // فتح تفاصيل موظف
  const openDetails = async (snap) => {
    if (selectedId === snap.userId) { setSelectedId(null); setSelectedSnap(null); return; }
    setSelectedId(snap.userId);
    setLoadingDet(true);
    try {
      const res = await api.get(`/kpis/${snap.userId}/${snap.periodType}/${snap.periodLabel}`);
      setSelectedSnap(res.data);
    } catch { toast.error('تعذر تحميل التفاصيل'); setSelectedId(null); }
    finally { setLoadingDet(false); }
  };

  const refreshDetail = async () => {
    if (!selectedSnap) return;
    const res = await api.get(`/kpis/${selectedSnap.userId}/${selectedSnap.periodType}/${selectedSnap.periodLabel}`).catch(() => null);
    if (res) setSelectedSnap(res.data);
    await load();
  };

  // تنقل بين الأشهر
  const prevMonth = () => {
    if (month === 1) { setYear(y => y-1); setMonth(12); }
    else setMonth(m => m-1);
  };
  const nextMonth = () => {
    const nm = month === 12 ? 1 : month+1;
    const ny = month === 12 ? year+1 : year;
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth()+1)) return;
    setMonth(nm); if (month === 12) setYear(y => y+1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()+1;

  // إحصائيات
  // تقسيم الموظفين: نشطون (لديهم دورات) وغير نشطين
  const activeSnaps   = useMemo(() => snapshots.filter(x => x.isSubjectToEvaluation), [snapshots]);
  const inactiveSnaps = useMemo(() => snapshots.filter(x => !x.isSubjectToEvaluation), [snapshots]);

  const stats = useMemo(() => {
    const counts = {};
    for (const key of Object.keys(LEVEL_CFG)) counts[key] = activeSnaps.filter(x => x.performanceLevel === key).length;
    const avg = activeSnaps.length ? activeSnaps.reduce((a,x) => a + Number(x.finalScoreDisplay ?? x.finalScore ?? 0), 0) / activeSnaps.length : 0;
    return { counts, avg, total: activeSnaps.length, noData: inactiveSnaps.length };
  }, [activeSnaps, inactiveSnaps]);

  const teamBarData = useMemo(() =>
    activeSnaps.filter(s => s.finalScoreDisplay != null)
      .map(s => ({ name: `${s.user?.firstName||''} ${s.user?.lastName||''}`.trim(), score: Number(s.finalScoreDisplay||s.finalScore||0) })),
  [activeSnaps]);

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* ─── رأس الصفحة ─── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="text-xl font-extrabold text-primary">📊 مؤشرات الأداء</h1>
              <p className="mt-0.5 text-xs text-text-soft">قياس أداء الفريق بـ 6 مؤشرات ذكية مرتبطة بمواعيد الإقفال</p>
            </div>

            {/* تنقل الأشهر */}
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-soft hover:bg-background">‹</button>
              <div className="min-w-[120px] text-center">
                <span className="font-extrabold text-primary">{AR_MONTHS[month-1]} {year}</span>
                {isCurrentMonth && <span className="mr-1 text-[10px] text-success">● الحالي</span>}
              </div>
              <button onClick={nextMonth} disabled={isCurrentMonth}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-soft hover:bg-background disabled:opacity-30">›</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lastCalc && <span className="text-[10px] text-text-soft">آخر احتساب: {fmtRelative(lastCalc)}</span>}
              {isManager && (
                <button onClick={calculate} disabled={calculating}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                  {calculating ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> احتساب...</> : '⚙ احتسب المؤشرات'}
                </button>
              )}
            </div>
          </div>

          {/* توزيع المستويات */}
          {!loading && snapshots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
              <div className="flex items-center gap-1 rounded-xl border border-primary/20 bg-primary-light px-3 py-1.5">
                <span className="text-sm font-extrabold text-primary">{fmt(stats.avg)}%</span>
                <span className="text-xs text-text-soft">متوسط الفريق</span>
              </div>
              {Object.entries(LEVEL_CFG).map(([key, cfg]) => stats.counts[key] > 0 && (
                <div key={key} className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  <span>{stats.counts[key]}</span>
                  <span>{cfg.label}</span>
                </div>
              ))}
              {stats.noData > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                  {stats.noData} بدون بيانات
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── لا توجد بيانات ─── */}
        {!loading && snapshots.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center shadow-card">
            <div className="text-5xl mb-3">📊</div>
            <h3 className="text-lg font-extrabold text-text-main">لا توجد بيانات لـ {AR_MONTHS[month-1]} {year}</h3>
            <p className="mt-1 text-sm text-text-soft mb-4">
              {isManager ? 'اضغط "احتسب المؤشرات" لبدء احتساب أداء الفريق لهذه الفترة' : 'لم يتم احتساب مؤشرات هذه الفترة بعد'}
            </p>
            {isManager && (
              <button onClick={calculate} disabled={calculating}
                className="rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                {calculating ? 'جاري الاحتساب...' : '⚙ احتسب الآن'}
              </button>
            )}
          </div>
        )}

        {/* ─── جاري التحميل ─── */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-text-soft">جاري تحميل مؤشرات {AR_MONTHS[month-1]}...</span>
            </div>
          </div>
        )}

        {/* ─── مقارنة الفريق (مخطط) ─── */}
        {!loading && teamBarData.length > 1 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-extrabold text-text-main">📈 مقارنة أداء الفريق</h3>
              <p className="text-xs text-text-soft">الدرجة الكلية — أخضر ≥ 80% / أصفر ≥ 60% / أحمر &lt; 60%</p>
            </div>
            <div className="p-4">
              <TeamBarChart data={teamBarData} />
            </div>
          </div>
        )}

        {/* ─── شبكة بطاقات الموظفين النشطين ─── */}
        {!loading && activeSnaps.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {activeSnaps.map((snap, idx) => {
              const uid = snap.userId;
              const isSelected = selectedId === uid;
              return (
                <div key={uid}>
                  <EmployeeCard snap={snap} selected={isSelected} onSelect={openDetails} isManager={isManager} />

                  {/* التفاصيل تفتح مباشرة تحت البطاقة في المحمول */}
                  {isSelected && loadingDet && (
                    <div className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-border bg-white p-6 text-text-soft sm:hidden">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-xs">جاري التحميل...</span>
                    </div>
                  )}
                  {isSelected && selectedSnap && (
                    <div className="mt-2 sm:hidden">
                      <DetailsPanel snap={selectedSnap} isManager={isManager} onClose={() => { setSelectedId(null); setSelectedSnap(null); }} onNoteAdded={refreshDetail} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── موظفون بدون دورات في هذه الفترة ─── */}
        {!loading && inactiveSnaps.length > 0 && (
          <details className="overflow-hidden rounded-2xl border border-dashed border-forest-200 bg-forest-50/30">
            <summary className="cursor-pointer px-5 py-3 text-sm font-bold text-text-soft hover:text-primary list-none flex items-center justify-between">
              <span>⏸ موظفون بدون نشاط في {AR_MONTHS[month-1]} {year} ({inactiveSnaps.length} موظف)</span>
              <span className="text-xs">▼ عرض</span>
            </summary>
            <div className="border-t border-forest-100 px-5 py-3">
              <p className="mb-3 text-xs text-text-soft">هؤلاء الموظفون لا تُحسَب لهم مؤشرات هذه الفترة لأن دوراتهم تقع خارج نطاقها الزمني.</p>
              <div className="flex flex-wrap gap-2">
                {inactiveSnaps.map(s => (
                  <div key={s.userId} className="flex items-center gap-2 rounded-xl border border-forest-100 bg-white px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-100 text-[11px] font-bold text-forest-600">
                      {s.user?.firstName?.[0]}{s.user?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-main">{s.user?.firstName} {s.user?.lastName}</p>
                      <p className="text-[10px] text-text-soft">{s.user?.operationalProject?.name || '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        {/* ─── التفاصيل في الشاشات الكبيرة ─── */}
        {!loading && (loadingDet || selectedSnap) && (
          <div className="hidden sm:block">
            {loadingDet ? (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-10 shadow-card">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <span className="mr-2 text-sm text-text-soft">جاري تحميل التفاصيل...</span>
              </div>
            ) : selectedSnap ? (
              <DetailsPanel snap={selectedSnap} isManager={isManager}
                onClose={() => { setSelectedId(null); setSelectedSnap(null); }}
                onNoteAdded={refreshDetail} />
            ) : null}
          </div>
        )}

        {/* ─── تقرير أداء المشرفين ─── */}
        {isManager && <SupervisorReport periodLabel={periodLabel} />}

        {/* ─── سجل الإسناد (مخفي) ─── */}
        {isManager && <AssignmentSection periodLabel={periodLabel} year={year} month={month} />}

      </div>
    </MainLayout>
  );
}

// ─── تقرير أداء المشرفين ─────────────────────────────────────

function SupervisorReport({ periodLabel }) {
  const [data, setData]   = useState([]);
  const [show, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/supervisor-performance', { params: { periodType:'MONTHLY', periodLabel } })
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  const RESP_COLOR = { 'سريع جداً':'text-success bg-forest-50 border-forest-200', 'مقبول':'text-primary bg-primary-light border-primary/20', 'بطيء':'text-warning bg-sand/20 border-sand/50', 'متأخر':'text-danger bg-burgundy/10 border-burgundy/30' };

  return (
    <div className="overflow-hidden rounded-2xl border border-forest-200 bg-white shadow-card">
      <button onClick={()=>setShow(v=>!v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition">
        <div className="flex items-center gap-2">
          <span className="text-base">👑</span>
          <div className="text-right">
            <h4 className="text-sm font-extrabold text-text-main">تقرير أداء المشرفين</h4>
            <p className="text-[10px] text-text-soft">سرعة البت + معدل الاعتماد — للمدير فقط</p>
          </div>
        </div>
        <span className="text-xs text-text-soft">{show ? '▲ إخفاء' : '▼ إظهار'}</span>
      </button>
      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-text-soft text-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              جاري التحميل...
            </div>
          ) : !data.length ? (
            <div className="py-8 text-center text-sm text-text-soft">لا توجد بيانات بت لهذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['المشرف','إجمالي البت','معتمد','مُعاد','مرفوض','معدل الاعتماد','متوسط وقت البت','التقييم'].map(h=>(
                      <th key={h} className="px-3 py-2 text-right font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map(s=>(
                    <tr key={s.userId} className="hover:bg-background">
                      <td className="px-3 py-2 font-bold text-text-main">{s.name}</td>
                      <td className="px-3 py-2 text-center font-extrabold text-primary">{s.totalDecisions}</td>
                      <td className="px-3 py-2 text-center text-success font-bold">{s.approved}</td>
                      <td className="px-3 py-2 text-center text-warning">{s.returned}</td>
                      <td className="px-3 py-2 text-center text-danger">{s.rejected}</td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-forest-100">
                          <div className="h-full rounded-full bg-accent transition-all" style={{width:`${s.approvalRate}%`}} />
                        </div>
                        <span className="text-[10px] font-bold">{s.approvalRate}%</span>
                      </td>
                      <td className="px-3 py-2 font-bold text-text-main">
                        {s.avgResponseHours != null ? `${s.avgResponseHours} ساعة` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 font-bold ${RESP_COLOR[s.responsiveness]||'bg-background text-text-soft border-border'}`}>
                          {s.responsiveness}
                        </span>
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

// ─── سجل الإسناد المخفي ───────────────────────────────────────

function AssignmentSection({ periodLabel, year, month }) {
  const [show, setShow]         = useState(false);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState({});

  useEffect(() => {
    if (!show) return;
    setLoading(true);
    api.get('/kpis/assignments', { params: { periodType:'MONTHLY', year: Number(year), value: Number(month) } })
      .then(r => setRows((r.data?.rows||[]).map(row => ({ ...row, inp: row.assignedCoursesCount == null ? '' : String(row.assignedCoursesCount), ni: row.notes||'' }))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [show, periodLabel]);

  const upd = (uid, f, v) => setRows(prev => prev.map(r => r.userId === uid ? {...r, [f]: v} : r));

  const save = async (row) => {
    const count = Number(String(row.inp).trim());
    if (isNaN(count) || count < 0) { toast.error('عدد غير صحيح'); return; }
    setSaving(p => ({...p, [row.userId]: true}));
    try {
      await api.post('/kpis/assignments', { userId: row.userId, periodType:'MONTHLY', year: Number(year), value: Number(month), assignedCoursesCount: count, notes: row.ni||'' });
      toast.success('حُفظ');
    } catch { toast.error('تعذر الحفظ'); }
    finally { setSaving(p => ({...p, [row.userId]: false})); }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <button onClick={() => setShow(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-background transition">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <div className="text-right">
            <h4 className="text-sm font-extrabold text-text-main">سجل الإسناد التخطيطي</h4>
            <p className="text-[10px] text-text-soft">اختياري — لتحديد العدد المخطط مسبقاً</p>
          </div>
        </div>
        <span className="text-xs text-text-soft">{show ? '▲ إخفاء' : '▼ إظهار'}</span>
      </button>
      {!show && (
        <div className="border-t border-border bg-amber-50/40 px-5 py-2 text-[10px] text-amber-700">
          💡 هذا السجل مخصص للتخطيط المسبق فقط — KPI يعمل بالكامل بدونه
        </div>
      )}
      {show && (
        <div className="border-t border-border">
          {loading ? (
            <div className="py-6 text-center text-xs text-text-soft">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-background text-text-soft">
                  <tr>
                    {['الموظف','الفعلي','المخطط','التغطية','ملاحظة',''].map(h => <th key={h} className="px-3 py-2 text-right font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.userId} className="hover:bg-background">
                      <td className="px-3 py-2"><div className="font-bold text-text-main">{row.employeeName}</div><div className="text-text-soft">{row.projectName}</div></td>
                      <td className="px-3 py-2 text-center font-extrabold text-primary">{row.actualCoursesCount}</td>
                      <td className="px-3 py-2"><input type="number" min="0" value={row.inp} onChange={e => upd(row.userId,'inp',e.target.value)} className="w-16 rounded-lg border border-border px-2 py-1 outline-none focus:border-primary" /></td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${Number(row.courseRegistrationCoverageRate) >= 100 ? 'text-success' : 'text-warning'}`}>
                          {Number(row.courseRegistrationCoverageRate).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2"><input value={row.ni} onChange={e => upd(row.userId,'ni',e.target.value)} className="w-32 rounded-lg border border-border px-2 py-1 outline-none focus:border-primary" placeholder="ملاحظة" /></td>
                      <td className="px-3 py-2"><button onClick={() => save(row)} disabled={!!saving[row.userId]} className="rounded-lg bg-primary px-3 py-1 font-bold text-white disabled:opacity-50">{saving[row.userId] ? '...' : 'حفظ'}</button></td>
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
