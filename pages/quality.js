// صفحة مراقب الجودة — قراءة فقط للتقارير والمؤشرات
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import Link from 'next/link';
import toast from 'react-hot-toast';

const RadarKPI     = dynamic(() => import('../components/charts/RadarKPI'),     { ssr: false });

function fmt(v, d=1) {
  if (v == null) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(d);
}

const LEVEL_LABEL = { OUTSTANDING:'متميز', VERY_GOOD:'جيد جداً', GOOD:'جيد', NEEDS_IMPROVEMENT:'يحتاج تحسين', WEAK:'ضعيف' };
const LEVEL_CLS   = { OUTSTANDING:'bg-forest-50 text-primary border-forest-200', VERY_GOOD:'bg-primary-light text-primary border-primary/20', GOOD:'bg-forest-100 text-text-main border-forest-200', NEEDS_IMPROVEMENT:'bg-sand/20 text-warning border-sand/50', WEAK:'bg-burgundy/10 text-danger border-burgundy/30' };

export default function QualityPage() {
  const { activeRole } = useAuth();
  const [reports, setReports] = useState([]);
  const [kpi,     setKpi]     = useState([]);
  const [loading, setLoading] = useState(true);

  const now   = new Date();
  const month = String(now.getMonth()+1).padStart(2,'0');
  const label = `${now.getFullYear()}-${month}`;

  useEffect(() => {
    Promise.all([
      api.get('/reports'),
      api.get(`/kpis?periodType=MONTHLY&periodLabel=${label}`),
    ]).then(([r, k]) => {
      setReports(Array.isArray(r.data) ? r.data : []);
      setKpi(k.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [label]);

  const activeKpi = useMemo(() => (kpi||[]).filter(s=>s.isSubjectToEvaluation), [kpi]);

  const handlePrint = async (id) => {
    try {
      const res = await api.get(`/closure/${id}/export`, { responseType:'text', headers:{Accept:'text/html'} });
      const w = window.open('','_blank');
      if (!w) return toast.error('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch { toast.error('تعذر فتح التقرير'); }
  };

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <h1 className="text-xl font-extrabold text-primary">📊 لوحة الجودة</h1>
          <p className="mt-0.5 text-xs text-text-soft">عرض قراءة فقط — التقارير الميدانية ومؤشرات الأداء</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* مؤشرات الأداء */}
            {activeKpi.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-extrabold text-text-main">مؤشرات أداء الفريق — {label}</h2>
                  <p className="mt-0.5 text-xs text-text-soft">متوسط الفريق: {fmt(activeKpi.reduce((a,s)=>a+Number(s.finalScore||0),0)/activeKpi.length)}%</p>
                </div>
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {activeKpi.map(s => {
                    const score = Number(s.finalScore||0);
                    const lc = LEVEL_CLS[s.performanceLevel] || LEVEL_CLS.GOOD;
                    return (
                      <div key={s.userId} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-extrabold text-sm text-text-main">{s.user?.firstName} {s.user?.lastName}</p>
                            <p className="text-[10px] text-text-soft">{s.user?.operationalProject?.name}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${lc}`}>{LEVEL_LABEL[s.performanceLevel]||'-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest-100">
                            <div className="h-full rounded-full bg-accent transition-all" style={{width:`${Math.min(100,score)}%`}} />
                          </div>
                          <span className="text-xs font-extrabold text-primary w-10 text-left">{fmt(score)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* التقارير الميدانية */}
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-extrabold text-text-main">التقارير الميدانية</h2>
                <p className="mt-0.5 text-xs text-text-soft">{reports.length} تقرير متاح</p>
              </div>
              {reports.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-soft">لا توجد تقارير متاحة</div>
              ) : (
                <div className="divide-y divide-border">
                  {reports.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-background">
                      <div>
                        <p className="font-bold text-sm text-text-main">{r.courseName}</p>
                        <p className="text-xs text-text-soft">{r.reportType} • {r.presenterName}</p>
                      </div>
                      <button onClick={() => handlePrint(r.id)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary">
                        🖨️ طباعة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
