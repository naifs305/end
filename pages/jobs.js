import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import {
  Clock,
  PauseCircle,
  BarChart3,
  Settings,
  Plus,
  X,
  Lightbulb,
  AlertTriangle,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import ConfirmModal from '../components/operational/ConfirmModal';
import { useTranslation } from '../lib/i18n';

// أيقونات أنواع المهام — التسميات والأوصاف من الترجمة
const JOB_ICON = {
  COURSE_DELAY_CHECK: Clock,
  ELEMENT_STALE_CHECK: PauseCircle,
  KPI_AUTO_SNAPSHOT: BarChart3,
  CUSTOM: Settings,
};

const STATUS_CLS = {
  ACTIVE:    'bg-forest-50 text-accent border-accent/20',
  PAUSED:    'bg-sand/20 text-warning border-sand/40',
  COMPLETED: 'bg-primary-light text-primary border-primary/20',
  FAILED:    'bg-burgundy/10 text-danger border-burgundy/20',
};

const JOB_TYPES = ['COURSE_DELAY_CHECK', 'ELEMENT_STALE_CHECK', 'KPI_AUTO_SNAPSHOT', 'CUSTOM'];

export default function JobsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [jobs, setJobs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]   = useState({ name: '', type: 'COURSE_DELAY_CHECK', intervalHours: 24 });
  const [showForm, setShowForm] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [busy, setBusy] = useState(false);

  const fmtRelative = (v) => {
    if (!v) return t('admin.jobs.notRunYet');
    const diff = Date.now() - new Date(v).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return t('admin.jobs.momentsAgo');
    if (mins < 60) return t('admin.jobs.minutesAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return t('admin.jobs.hoursAgo', { count: hrs });
    return t('admin.jobs.daysAgo', { count: Math.floor(hrs / 24) });
  };

  const fmtNext = (v) => {
    if (!v) return '-';
    const diff = new Date(v).getTime() - Date.now();
    if (diff <= 0) return t('admin.jobs.soon');
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('admin.jobs.inMinutes', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return t('admin.jobs.inHours', { count: hrs });
    return t('admin.jobs.inDays', { count: Math.floor(hrs / 24) });
  };

  useEffect(() => {
    if (!authLoading && activeRole !== 'MANAGER') { toast.error(t('admin.jobs.managerRequired')); router.push('/'); }
  }, [activeRole, authLoading, router]);

  useEffect(() => {
    if (user && activeRole === 'MANAGER') load();
  }, [user, activeRole]);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/scheduled-jobs'); setJobs(res.data || []); }
    catch { toast.error(t('admin.jobs.loadFailed')); }
    finally { setLoading(false); }
  };

  const createJob = async () => {
    if (!form.name.trim()) { toast.error(t('admin.jobs.nameRequired')); return; }
    try {
      await api.post('/scheduled-jobs', form);
      toast.success(t('admin.jobs.created'));
      setForm({ name: '', type: 'COURSE_DELAY_CHECK', intervalHours: 24 });
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.response?.data?.message || t('admin.jobs.createFailed')); }
  };

  const toggleJob = async (job) => {
    const s = job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try { await api.put(`/scheduled-jobs/${job.id}`, { status: s }); toast.success(s === 'ACTIVE' ? t('admin.jobs.activated') : t('admin.jobs.paused2')); load(); }
    catch { toast.error(t('admin.jobs.toggleFailed')); }
  };

  const confirmDeleteJob = async () => {
    if (!confirmState) return;
    setBusy(true);
    try { await api.delete(`/scheduled-jobs/${confirmState.id}`); toast.success(t('admin.jobs.deleted')); load(); }
    catch { toast.error(t('admin.jobs.deleteFailed')); }
    finally { setBusy(false); setConfirmState(null); }
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
            <h1 className="text-xl font-extrabold text-primary">{t('admin.jobs.title')}</h1>
            <p className="mt-0.5 text-xs text-text-soft">
              {t('admin.jobs.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2 text-xs">
              <span className="rounded-xl border border-accent/20 bg-forest-50 px-3 py-1.5 font-bold text-accent">{t('admin.jobs.active', { count: active })}</span>
              {paused  > 0 && <span className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-1.5 font-bold text-warning">{t('admin.jobs.paused', { count: paused })}</span>}
              {errored > 0 && <span className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-1.5 font-bold text-danger">{t('admin.jobs.errored', { count: errored })}</span>}
            </div>
            <button onClick={() => setShowForm(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">
              {showForm
                ? (<><X size={15} aria-hidden="true" /> {t('admin.jobs.closeForm')}</>)
                : (<><Plus size={15} aria-hidden="true" /> {t('admin.jobs.newJob')}</>)}
            </button>
          </div>
        </div>

        {/* نموذج الإنشاء */}
        {showForm && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-text-main">{t('admin.jobs.createTitle')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder={t('admin.jobs.namePlaceholder')}
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                {JOB_TYPES.map((k) => <option key={k} value={k}>{t(`admin.jobs.types.${k}`)}</option>)}
              </select>
              <input type="number" min="1" value={form.intervalHours}
                onChange={(e) => setForm({...form, intervalHours: Number(e.target.value)})}
                placeholder={t('admin.jobs.intervalPlaceholder')}
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              <button onClick={createJob}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">{t('admin.jobs.createButton')}</button>
            </div>
            {form.type && t(`admin.jobs.typeDescriptions.${form.type}`) && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-soft">
                <Lightbulb size={13} aria-hidden="true" /> {t(`admin.jobs.typeDescriptions.${form.type}`)}
              </p>
            )}
          </div>
        )}

        {/* قائمة المهام */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-soft">{t('admin.jobs.empty')}</div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((job) => {
                const JobIcon = JOB_ICON[job.type] || JOB_ICON.CUSTOM;
                const scls = STATUS_CLS[job.status] || STATUS_CLS.ACTIVE;
                return (
                  <div key={job.id} className="flex items-start gap-3 px-4 py-4 hover:bg-background transition">
                    <JobIcon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-text-soft" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-text-main">{job.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${scls}`}>{t(`admin.jobs.statuses.${job.status}`) || job.status}</span>
                        <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-text-soft">{t(`admin.jobs.types.${job.type}`) || job.type}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-4 text-xs text-text-soft">
                        <span>{t('admin.jobs.everyHours', { count: job.intervalHours })}</span>
                        <span>• {t('admin.jobs.lastRun')} <strong>{fmtRelative(job.lastRunAt)}</strong></span>
                        <span>• {t('admin.jobs.nextRun')} <strong className="text-primary">{fmtNext(job.nextRunAt)}</strong></span>
                        <span>• {t('admin.jobs.runCount')} <strong>{job.runCount}</strong></span>
                      </div>
                      {job.lastError && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border border-burgundy/20 bg-burgundy/5 px-2 py-1 text-xs text-danger">
                          <AlertTriangle size={13} aria-hidden="true" /> {t('admin.jobs.lastErrorLabel')} {job.lastError}
                        </div>
                      )}
                      {job.lastResult && !job.lastError && (
                        <div className="mt-1 text-[10px] text-text-soft">
                          {t('admin.jobs.lastResultLabel')} {JSON.stringify(job.lastResult).slice(0, 80)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => toggleJob(job)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${job.status === 'ACTIVE' ? 'border-sand/40 bg-sand/10 text-warning hover:bg-sand/20' : 'border-accent/20 bg-forest-50 text-accent hover:bg-forest-50'}`}>
                        {job.status === 'ACTIVE'
                          ? (<><Pause size={13} aria-hidden="true" /> {t('admin.jobs.pause')}</>)
                          : (<><Play size={13} aria-hidden="true" /> {t('admin.jobs.resume')}</>)}
                      </button>
                      <button onClick={() => setConfirmState({ id: job.id, name: job.name })}
                        className="inline-flex items-center gap-1 rounded-xl border border-burgundy/20 px-3 py-1.5 text-xs font-bold text-danger hover:bg-burgundy/5">
                        <Trash2 size={13} aria-hidden="true" /> {t('common.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        open={!!confirmState}
        title={t('common.delete')}
        message={confirmState ? t('admin.jobs.deleteConfirm', { name: confirmState.name }) : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        loading={busy}
        onConfirm={confirmDeleteJob}
        onCancel={() => setConfirmState(null)}
      />
    </MainLayout>
  );
}
