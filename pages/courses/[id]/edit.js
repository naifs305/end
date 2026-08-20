import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import { Calendar, X, ClipboardList, Settings, ArrowLeft, Star, Check } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import api from '../../../lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../lib/i18n';
import { useOptions } from '../../../lib/hooks/useOptions';

function fmtDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DateInput = forwardRef(function DateInput({ startDate, endDate, onClick, onClear }, ref) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-white px-4 py-3 text-start text-sm outline-none hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10"
    >
      <div className="flex items-center gap-3">
        <Calendar size={18} aria-hidden="true" className="text-text-soft" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="rounded-lg bg-background px-3 py-2">
            <div className="text-[10px] text-text-soft">{t('course.form.from')}</div>
            <div className="font-bold text-text-main">{startDate || '—'}</div>
          </div>
          <div className="rounded-lg bg-background px-3 py-2">
            <div className="text-[10px] text-text-soft">{t('course.form.to')}</div>
            <div className="font-bold text-text-main">{endDate || '—'}</div>
          </div>
        </div>
        {(startDate || endDate) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-text-soft hover:bg-background"
          >
            <X size={12} aria-hidden="true" />
          </span>
        )}
      </div>
    </button>
  );
});

function Toggle({ label, desc, checked, onChange, critical }) {
  const { t } = useTranslation();
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition
        ${checked ? 'border-primary/30 bg-primary-light/50' : 'border-border bg-background hover:border-primary/20'}
        ${critical ? 'ring-1 ring-primary/20' : ''}`}
    >
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-forest-200'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[-1px] rtl:translate-x-4' : 'translate-x-[-1px] rtl:translate-x-0.5'}`} />
      </button>
      <div>
        <div className={`flex items-center gap-1 text-sm font-bold ${checked ? 'text-primary' : 'text-text-main'}`}>
          {label}
          {critical && (
            <span className="inline-flex items-center gap-0.5 text-xs font-normal text-sand">
              <Star size={11} aria-hidden="true" /> {t('course.form.critical')}
            </span>
          )}
        </div>
        {desc && <div className="mt-0.5 text-[11px] text-text-soft">{desc}</div>}
      </div>
    </label>
  );
}

function Field({ label, required, children, span2 }) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-bold text-text-main">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';

export default function EditCoursePage() {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation();
  const { options: locationOptions } = useOptions('LOCATION_TYPE');
  const { options: cityOptions } = useOptions('CITY');

  const [form, setForm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/courses/${id}`), api.get('/projects')])
      .then(([cr, pr]) => {
        const c = cr.data;
        const projects = Array.isArray(pr.data) ? pr.data : pr.data?.data || [];
        setProjects(projects);
        setForm({
          name: c.name || '',
          code: c.code || '',
          beneficiaryEntity: c.beneficiaryEntity || '',
          city: c.city || '',
          locationType: c.locationType || '',
          startDate: c.startDate ? fmtDate(new Date(c.startDate)) : '',
          endDate: c.endDate ? fmtDate(new Date(c.endDate)) : '',
          numTrainees: c.numTrainees != null ? String(c.numTrainees) : '',
          operationalProjectId: c.operationalProjectId || c.operationalProject?.id || '',
          requiresAdvance: !!c.requiresAdvance,
          requiresAdvanceSettlement: !!c.requiresAdvanceSettlement,
          requiresRevenue: !!c.requiresRevenue,
          materialsIssued: !!c.materialsIssued,
          requiresSupervisorCompensation: !!c.requiresSupervisorCompensation,
          requiresTrainerCompensation: !!c.requiresTrainerCompensation,
          requiresPreTest: !!c.requiresPreTest,
          requiresPostTest: !!c.requiresPostTest,
        });
      })
      .catch(() => toast.error(t('course.form.loadFailed')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ضمّ القيمة الحالية للمدينة إن لم تكن ضمن الخيارات
  const cityList = useMemo(() => {
    if (!form?.city) return cityOptions;
    const has = cityOptions.some((o) => o.label === form.city || o.value === form.city);
    return has ? cityOptions : [{ value: form.city, label: form.city }, ...cityOptions];
  }, [cityOptions, form?.city]);

  const canSubmit = useMemo(
    () =>
      form && form.name.trim() && form.operationalProjectId && form.locationType && form.city.trim() && form.startDate && form.endDate && form.numTrainees && Number(form.numTrainees) > 0,
    [form]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error(t('course.form.completeRequired'));
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error(t('course.form.dateError'));
      return;
    }
    setSaving(true);
    try {
      await api.put(`/courses/${id}`, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        beneficiaryEntity: form.beneficiaryEntity.trim() || undefined,
        city: form.city.trim(),
        locationType: form.locationType,
        startDate: form.startDate,
        endDate: form.endDate,
        numTrainees: Number(form.numTrainees),
        operationalProjectId: form.operationalProjectId,
        courseType: form.locationType === 'INTERNAL' ? 'internal' : form.locationType === 'REMOTE' ? 'remote' : 'external',
        requiresAdvance: form.requiresAdvance,
        requiresAdvanceSettlement: form.requiresAdvanceSettlement,
        requiresRevenue: form.requiresRevenue,
        materialsIssued: form.materialsIssued,
        requiresSupervisorCompensation: form.requiresSupervisorCompensation,
        requiresTrainerCompensation: form.requiresTrainerCompensation,
        requiresPreTest: form.requiresPreTest,
        requiresPostTest: form.requiresPostTest,
      });
      toast.success(t('course.form.updatedSuccess'));
      router.push(`/courses/${id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('course.form.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form)
    return (
      <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: t('course.form.editTitle') }]}>
        <div className="flex items-center justify-center py-20 text-text-soft">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );

  const sDate = form.startDate ? new Date(form.startDate) : null;
  const eDate = form.endDate ? new Date(form.endDate) : null;

  return (
    <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: form.name || t('course.form.editTitle') }]}>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-primary">{t('course.form.editTitle')}</h1>
              <p className="mt-0.5 max-w-xs truncate text-xs text-text-soft">{form.name}</p>
            </div>
            <button
              onClick={() => router.push(`/courses/${id}`)}
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background"
            >
              <ArrowLeft size={16} aria-hidden="true" /> {t('common.back')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-4 inline-flex items-center gap-2 font-extrabold text-text-main">
              <ClipboardList size={18} aria-hidden="true" className="text-primary" /> {t('course.form.basicData')}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t('course.form.name')} required span2>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder={t('course.form.name')} className={inputCls} />
              </Field>
              <Field label={t('course.form.code')}>
                <input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder={t('course.form.codePlaceholder')} className={inputCls} />
              </Field>
              <Field label={t('course.form.beneficiary')}>
                <input value={form.beneficiaryEntity} onChange={(e) => set('beneficiaryEntity', e.target.value)} placeholder={t('course.form.beneficiaryPlaceholder')} className={inputCls} />
              </Field>
              <Field label={t('course.form.locationType')} required>
                <select value={form.locationType} onChange={(e) => set('locationType', e.target.value)} required className={inputCls}>
                  <option value="">{t('course.form.selectLocation')}</option>
                  {locationOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('course.form.city')} required>
                <select value={form.city} onChange={(e) => set('city', e.target.value)} required className={inputCls}>
                  <option value="">{t('course.form.selectCity')}</option>
                  {cityList.map((o) => (
                    <option key={o.value} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('course.form.project')} required>
                <select value={form.operationalProjectId} onChange={(e) => set('operationalProjectId', e.target.value)} required className={inputCls}>
                  <option value="">{t('course.form.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('course.form.dateRangeShort')} required span2>
                <DatePicker
                  selected={sDate}
                  onChange={([s, e]) => {
                    set('startDate', fmtDate(s));
                    set('endDate', fmtDate(e));
                    if (s && e) setTimeout(() => setDateOpen(false), 60);
                  }}
                  startDate={sDate}
                  endDate={eDate}
                  selectsRange
                  open={dateOpen}
                  onInputClick={() => setDateOpen(true)}
                  onClickOutside={() => setDateOpen(false)}
                  shouldCloseOnSelect={false}
                  monthsShown={2}
                  dateFormat="yyyy-MM-dd"
                  customInput={<DateInput startDate={form.startDate} endDate={form.endDate} onClear={() => { set('startDate', ''); set('endDate', ''); }} />}
                />
              </Field>
              <Field label={t('course.form.numTrainees')} required>
                <input type="number" min="1" value={form.numTrainees} onChange={(e) => set('numTrainees', e.target.value)} required className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-1 inline-flex items-center gap-2 font-extrabold text-text-main">
              <Settings size={18} aria-hidden="true" className="text-primary" /> {t('course.form.opSettings')}
            </h2>
            <p className="mb-4 text-xs text-text-soft">{t('course.form.opSettingsDescEdit')}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Toggle label={t('course.form.requiresAdvance')} desc={t('course.form.requiresAdvanceDesc')} checked={form.requiresAdvance} onChange={(v) => set('requiresAdvance', v)} />
              <Toggle label={t('course.form.requiresAdvanceSettlement')} desc={t('course.form.requiresAdvanceSettlementDesc')} critical checked={form.requiresAdvanceSettlement} onChange={(v) => set('requiresAdvanceSettlement', v)} />
              <Toggle label={t('course.form.requiresRevenue')} desc={t('course.form.requiresRevenueDesc')} checked={form.requiresRevenue} onChange={(v) => set('requiresRevenue', v)} />
              <Toggle label={t('course.form.materialsIssued')} desc={t('course.form.materialsIssuedDesc')} checked={form.materialsIssued} onChange={(v) => set('materialsIssued', v)} />
              <Toggle label={t('course.form.requiresSupervisorCompensation')} desc={t('course.form.requiresSupervisorCompensationDesc')} critical checked={form.requiresSupervisorCompensation} onChange={(v) => set('requiresSupervisorCompensation', v)} />
              <Toggle label={t('course.form.requiresTrainerCompensation')} desc={t('course.form.requiresTrainerCompensationDesc')} critical checked={form.requiresTrainerCompensation} onChange={(v) => set('requiresTrainerCompensation', v)} />
              <Toggle label={t('course.form.requiresPreTest')} desc={t('course.form.requiresPreTestDesc')} checked={form.requiresPreTest} onChange={(v) => set('requiresPreTest', v)} />
              <Toggle label={t('course.form.requiresPostTest')} desc={t('course.form.requiresPostTestDesc')} checked={form.requiresPostTest} onChange={(v) => set('requiresPostTest', v)} />
            </div>
          </div>

          <div className="sticky bottom-4 z-10">
            <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-deep backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-1 text-xs text-text-soft">
                  {canSubmit && <Check size={14} aria-hidden="true" className="text-accent" />}
                  {canSubmit ? t('course.form.readySave') : t('course.form.completeRequired')}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.push(`/courses/${id}`)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-main hover:bg-background">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || saving}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {saving ? t('common.saving') : t('course.form.saveBtn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
