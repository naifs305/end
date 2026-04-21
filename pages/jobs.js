import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import { useRouter } from 'next/router';

const JOB_TYPES = {
  COURSE_DELAY_CHECK: 'فحص الدورات المتأخرة',
  ELEMENT_STALE_CHECK: 'فحص العناصر الراكدة',
  KPI_AUTO_SNAPSHOT: 'لقطة مؤشرات الأداء',
  CUSTOM: 'مخصصة',
};

const JOB_STATUSES = {
  ACTIVE: { label: 'نشطة', color: 'bg-success/10 text-success' },
  PAUSED: { label: 'متوقفة', color: 'bg-warning/10 text-warning' },
  COMPLETED: { label: 'مكتملة', color: 'bg-primary/10 text-primary' },
  FAILED: { label: 'فاشلة', color: 'bg-danger/10 text-danger' },
};

export default function JobsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    type: 'COURSE_DELAY_CHECK',
    intervalHours: 24,
  });

  useEffect(() => {
    if (!authLoading && activeRole !== 'MANAGER') {
      toast.error('صلاحية المدير مطلوبة');
      router.push('/');
    }
  }, [activeRole, authLoading, router]);

  useEffect(() => {
    if (user && activeRole === 'MANAGER') {
      loadJobs();
    }
  }, [user, activeRole]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/scheduled-jobs');
      setJobs(res.data);
    } catch (err) {
      toast.error('خطأ في تحميل المهام');
    } finally {
      setLoading(false);
    }
  };

  const createJob = async () => {
    if (!form.name.trim()) {
      toast.error('اسم المهمة مطلوب');
      return;
    }
    try {
      await api.post('/scheduled-jobs', form);
      toast.success('تم إنشاء المهمة');
      setForm({ name: '', type: 'COURSE_DELAY_CHECK', intervalHours: 24 });
      loadJobs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ');
    }
  };

  const toggleJob = async (job) => {
    const newStatus = job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await api.put(`/scheduled-jobs/${job.id}`, { status: newStatus });
      toast.success(newStatus === 'ACTIVE' ? 'تم التفعيل' : 'تم الإيقاف');
      loadJobs();
    } catch (err) {
      toast.error('خطأ');
    }
  };

  const deleteJob = async (id, name) => {
    if (!confirm(`حذف المهمة "${name}"؟`)) return;
    try {
      await api.delete(`/scheduled-jobs/${id}`);
      toast.success('تم الحذف');
      loadJobs();
    } catch (err) {
      toast.error('خطأ');
    }
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-text-soft">جاري التحميل...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <header>
          <h1 className="text-2xl font-extrabold text-primary">المهام المجدولة</h1>
          <p className="mt-1 text-sm text-text-soft">
            إدارة المهام الآلية (تنبيهات التأخير، لقطات الأداء، إلخ)
          </p>
        </header>

        {/* إنشاء مهمة جديدة */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">إنشاء مهمة جديدة</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم المهمة"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              {Object.entries(JOB_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={form.intervalHours}
              onChange={(e) => setForm({ ...form, intervalHours: Number(e.target.value) })}
              placeholder="ساعات التكرار"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <button
              onClick={createJob}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft"
            >
              إنشاء
            </button>
          </div>
        </section>

        {/* قائمة المهام */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">
            المهام الحالية ({jobs.length})
          </h2>
          {jobs.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-soft">لا توجد مهام</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const statusInfo = JOB_STATUSES[job.status] || JOB_STATUSES.ACTIVE;
                return (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-text-main">{job.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-text-soft">
                        {JOB_TYPES[job.type]} • كل {job.intervalHours} ساعة • تشغّل {job.runCount} مرة
                      </div>
                      {job.lastRunAt && (
                        <div className="mt-1 text-xs text-text-soft">
                          آخر تشغيل: {new Date(job.lastRunAt).toLocaleString('ar-SA')}
                        </div>
                      )}
                      {job.lastError && (
                        <div className="mt-1 text-xs text-danger">خطأ: {job.lastError}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleJob(job)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text-main hover:bg-primary-light"
                      >
                        {job.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => deleteJob(job.id, job.name)}
                        className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/5"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
