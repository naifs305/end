import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import { useRouter } from 'next/router';

const JOB_CFG = {
  COURSE_DELAY_CHECK:      { label: 'فحص تأخر الإقفال',      icon: '🕐', desc: 'يُرسل تنبيهات للدورات التي انتهت ولم تُقفل بعد يومين أو أربعة أو سبعة أو 14 يوماً' },
  ELEMENT_STALE_CHECK:     { label: 'فحص العناصر الراكدة',   icon: '⏸️', desc: 'يُنبّه الموظف بالعناصر التي لم يُحرَّك فيها أكثر من 3 أيام' },
  KPI_AUTO_SNAPSHOT:       { label: 'لقطة مؤشرات الأداء',   icon: '📊', desc: 'يحتسب مؤشرات الأداء تلقائياً ويحفظها في السجل' },
  CUSTOM:                  { label: 'مهمة مخصصة',           icon: '⚙️', desc: '' },
};

const STATUS_CFG = {
  ACTIVE:    { label: 'نشطة',    cls: 'bg-forest-50 text-accent border-accent/20' },
  PAUSED:    { label: 'متوقفة',  cls: 'bg-sand/20 text-warning border-sand/40' },
  COMPLETED: { label: 'مكتملة', cls: 'bg-primary-light text-primary border-primary/20' },
  FAILED:    { label: 'خطأ',    cls: 'bg-burgundy/10 text-danger border-burgundy/20' },
};

function fmtRelative(v) {
  if (!v) return 'لم تُشغَّل بعد';
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'منذ لحظات';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs/24)} يوم`;
}

function fmtNext(v) {
  if (!v) return '-';
  const diff = new Date(v).getTime() - Date.now();
  if (diff <= 0) return 'قريباً';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `خلال ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `خلال ${hrs} ساعة`;
  return `خلال ${Math.floor(hrs/24)} يوم`;
}

export default function JobsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const [jobs, setJobs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]   = useState({ name: '', type: 'COURSE_DELAY_CHECK', intervalHours: 24 });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && activeRole !== 'MANAGER') { toast.error('صلاحية المدير مطلوبة'); router.push('/'); }
  }, [activeRole, authLoading, router]);

  useEffect(() => {
    if (user && activeRole === 'MANAGER') load();
  }, [user, activeRole]);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/scheduled-jobs'); setJobs(res.data || []); }
    catch { toast.error('تعذر تحميل المهام'); }
    finally { setLoading(false); }
  };

  const createJob = async () => {
    if (!form.name.trim()) { toast.error('اسم المهمة مطلوب'); return; }
    try {
      await api.post('/scheduled-jobs', form);
      toast.success('تم إنشاء المهمة');
      setForm({ name: '', type: 'COURSE_DELAY_CHECK', intervalHours: 24 });
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'خطأ'); }
  };

  const toggleJob = async (job) => {
    const s = job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try { await api.put(`/scheduled-jobs/${job.id}`, { status: s }); toast.success(s === 'ACTIVE' ? 'تم التفعيل' : 'تم الإيقاف'); load(); }
    catch { toast.error('خطأ'); }
  };

  const deleteJob = async (id, name) => {
    if (!window.confirm(`حذف المهمة "${name}"؟`)) return;
    try { await api.delete(`/scheduled-jobs/${id}`); toast.success('تم الحذف'); load(); }
    catch { toast.error('خطأ'); }
  };

  const active  = jobs.filter(j => j.status === 'ACTIVE').length;
  const paused  = jobs.filter(j => j.status === 'PAUSED').length;
  const errored = jobs.filter(j => j.status === 'FAILED').length;

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div>
            <h1 className="text-xl font-extrabold text-primary">المهام المجدولة</h1>
            <p className="mt-0.5 text-xs text-text-soft">
              مهام آلية تعمل على مدار الساعة — تنبيهات التأخر، فحص العناصر، لقطات الأداء
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2 text-xs">
              <span className="rounded-xl border border-accent/20 bg-forest-50 px-3 py-1.5 font-bold text-accent">{active} نشطة</span>
              {paused  > 0 && <span className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-1.5 font-bold text-warning">{paused} متوقفة</span>}
              {errored > 0 && <span className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-1.5 font-bold text-danger">{errored} خطأ</span>}
            </div>
            <button onClick={() => setShowForm(v => !v)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">
              {showForm ? '✕ إغلاق' : '+ مهمة جديدة'}
            </button>
          </div>
        </div>

        {/* نموذج الإنشاء */}
        {showForm && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-text-main">إنشاء مهمة جديدة</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="اسم المهمة"
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                {Object.entries(JOB_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <input type="number" min="1" value={form.intervalHours}
                onChange={(e) => setForm({...form, intervalHours: Number(e.target.value)})}
                placeholder="التكرار (ساعات)"
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <button onClick={createJob}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">إنشاء</button>
            </div>
            {form.type && JOB_CFG[form.type]?.desc && (
              <p className="mt-2 text-xs text-text-soft">💡 {JOB_CFG[form.type].desc}</p>
            )}
          </div>
        )}

        {/* قائمة المهام */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">جاري التحميل...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-soft">لا توجد مهام</div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((job) => {
                const cfg  = JOB_CFG[job.type]  || JOB_CFG.CUSTOM;
                const scfg = STATUS_CFG[job.status] || STATUS_CFG.ACTIVE;
                return (
                  <div key={job.id} className="flex items-start gap-3 px-4 py-4 hover:bg-background transition">
                    <span className="mt-0.5 text-xl">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-text-main">{job.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${scfg.cls}`}>{scfg.label}</span>
                        <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-text-soft">{cfg.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-4 text-xs text-text-soft">
                        <span>كل <strong>{job.intervalHours}</strong> ساعة</span>
                        <span>• آخر تشغيل: <strong>{fmtRelative(job.lastRunAt)}</strong></span>
                        <span>• التالي: <strong className="text-primary">{fmtNext(job.nextRunAt)}</strong></span>
                        <span>• عدد التشغيلات: <strong>{job.runCount}</strong></span>
                      </div>
                      {job.lastError && (
                        <div className="mt-1.5 rounded-xl border border-burgundy/20 bg-burgundy/5 px-2 py-1 text-xs text-danger">
                          ⚠️ خطأ أخير: {job.lastError}
                        </div>
                      )}
                      {job.lastResult && !job.lastError && (
                        <div className="mt-1 text-[10px] text-text-soft">
                          نتيجة آخر تشغيل: {JSON.stringify(job.lastResult).slice(0, 80)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => toggleJob(job)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${job.status === 'ACTIVE' ? 'border-sand/40 bg-sand/10 text-warning hover:bg-sand/20' : 'border-accent/20 bg-forest-50 text-accent hover:bg-forest-50'}`}>
                        {job.status === 'ACTIVE' ? '⏸ إيقاف' : '▶ تفعيل'}
                      </button>
                      <button onClick={() => deleteJob(job.id, job.name)}
                        className="rounded-xl border border-burgundy/20 px-3 py-1.5 text-xs font-bold text-danger hover:bg-burgundy/5">
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
