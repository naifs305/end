import { forwardRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import { Calendar, X, ClipboardList, Settings, ArrowLeft, Plus, Star, Check, Sparkles, AlertTriangle, Award } from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from '../../lib/i18n';
import { useOptions } from '../../lib/hooks/useOptions';
import { CERTIFICATE_TYPES } from '../../lib/shared/certificateTypes';

function fmtDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const EMPTY = {
  name: '', beneficiaryEntity: '', city: '', locationType: '',
  startDate: '', endDate: '', numTrainees: '',
  operationalProjectId: '', domainId: '',
  certificateType: '',
  requiresAdvance: false,
  requiresRevenue: false, materialsIssued: false,
  requiresSupervisorCompensation: false, requiresTrainerCompensation: false,
  requiresPreTest: false, requiresPostTest: false,
  requiresInterpreter: false, interpreterContractType: '',
  externalTrainer: false, // عنصر اختياري: يُفعَّل بعد إنشاء الدورة
  lateEntryReason: '',
};

// أنواع التعاقد مع مترجم الدورة — كلٌّ يفتح عنصر الإقفال الخاص به
const INTERPRETER_TYPES = [
  { value: 'CONTRACT', key: 'interpreterTypeContract' },
  { value: 'TRANSFER', key: 'interpreterTypeTransfer' },
  { value: 'ADVANCE',  key: 'interpreterTypeAdvance'  },
];

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

function Toggle({ label, desc, checked, onChange, critical, disabled }) {
  const { t } = useTranslation();
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 transition
        ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
        ${checked ? 'border-primary/30 bg-primary-light/50' : 'border-border bg-background hover:border-primary/20'}
        ${critical ? 'ring-1 ring-primary/20' : ''}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
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

export default function CreateCoursePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const { options: locationOptions } = useOptions('LOCATION_TYPE');

  const [form, setForm] = useState(EMPTY);
  const [projects, setProjects] = useState([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/projects')
      .then((r) => {
        const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
        setProjects(d);
        if (d.length) setForm((p) => ({ ...p, operationalProjectId: p.operationalProjectId || d[0].id }));
      })
      .catch(() => toast.error(t('course.form.loadProjectsFailed')));
  }, [t]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // المجال يحدد المشروع: اختياره يضبط المشروع، وتغيير المشروع يُلغي مجالاً لا يتبعه
  const allDomains = useMemo(
    () => projects.flatMap((p) => (p.domains || []).map((d) => ({ ...d, projectId: p.id }))),
    [projects],
  );
  const projectDomains = allDomains.filter((d) => d.projectId === form.operationalProjectId);
  const pickDomain = (domainId) => {
    const d = allDomains.find((x) => x.id === domainId);
    setForm((p) => ({ ...p, domainId, ...(d ? { operationalProjectId: d.projectId } : {}) }));
  };
  const pickProject = (projectId) => {
    setForm((p) => ({
      ...p,
      operationalProjectId: projectId,
      domainId: allDomains.some((d) => d.id === p.domainId && d.projectId === projectId) ? p.domainId : '',
    }));
  };
  // نوع الشهادة يضبط الاختبارات: الاجتياز يستلزم البعدي، والحضور بلا اختبارات
  const pickCertificate = (type) => {
    setForm((p) => ({
      ...p,
      certificateType: type,
      ...(type === 'PASS' ? { requiresPostTest: true } : {}),
      ...(type === 'ATTENDANCE' ? { requiresPreTest: false, requiresPostTest: false } : {}),
    }));
  };

  const isCrossProject =
    user && form.operationalProjectId && user.operationalProjectId && form.operationalProjectId !== user.operationalProjectId;

  // ── الإدخال المتأخر ──────────────────────────────────────────────
  // المنصة لا تمنع إدخال دورة متأخرة أبداً — المنع يعني ضياع الدورة من
  // السجل كله. لكنها تقيس التأخير وتطلب مبرراً إلزامياً يبتّ فيه المدير.
  const LEAD_HOURS = 72; // أبكر عنصر: تسجيل المتدربين قبل البداية بـ٧٢ ساعة
  // لحظة فتح النموذج — ثابتة طوال الجلسة حتى يبقى الحساب مستقرّاً
  const [openedAt] = useState(() => Date.now());
  const lateness = useMemo(() => {
    if (!form.startDate) return { isLate: false, days: 0 };
    const expectedBy = new Date(form.startDate).getTime() - LEAD_HOURS * 3600000;
    const hours = (openedAt - expectedBy) / 3600000;
    return { isLate: hours > 0, days: Math.max(0, Math.round(hours / 24)) };
  }, [form.startDate, openedAt]);

  const canSubmit = useMemo(
    () =>
      form.name.trim() && form.operationalProjectId && form.locationType && form.city.trim()
      && form.startDate && form.endDate && form.numTrainees && Number(form.numTrainees) > 0
      && form.certificateType
      // المجال مطلوب متى كان لمشروع الدورة مجالات
      && (!projectDomains.length || !!form.domainId)
      && (!lateness.isLate || form.lateEntryReason.trim().length >= 10)
      // مترجم بلا نوع تعاقد يعني عنصراً لا يُفتح — فنمنع الحفظ ناقصاً
      && (!form.requiresInterpreter || !!form.interpreterContractType),
    [form, lateness.isLate, projectDomains.length]
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
      const payload = {
        name: form.name.trim(),
        beneficiaryEntity: form.beneficiaryEntity.trim() || undefined,
        city: form.city.trim(),
        locationType: form.locationType,
        startDate: form.startDate,
        endDate: form.endDate,
        numTrainees: Number(form.numTrainees),
        operationalProjectId: form.operationalProjectId,
        ...(form.domainId ? { domainId: form.domainId } : {}),
        certificateType: form.certificateType,
        primaryEmployeeId: user.id,
        courseType: form.locationType === 'INTERNAL' ? 'internal' : form.locationType === 'REMOTE' ? 'remote' : 'external',
        requiresAdvance: form.requiresAdvance,
        requiresRevenue: form.requiresRevenue,
        materialsIssued: form.materialsIssued,
        requiresSupervisorCompensation: form.requiresSupervisorCompensation,
        requiresTrainerCompensation: form.requiresTrainerCompensation,
        requiresPreTest: form.requiresPreTest,
        requiresPostTest: form.requiresPostTest,
        requiresInterpreter: form.requiresInterpreter,
        ...(form.requiresInterpreter ? { interpreterContractType: form.interpreterContractType } : {}),
        isCrossProject: isCrossProject || false,
        ...(lateness.isLate ? { lateEntryReason: form.lateEntryReason.trim() } : {}),
      };
      const res = await api.post('/courses', payload);
      toast.success(t('course.form.createdSuccess'));
      const id = res?.data?.id || res?.data?.data?.id;
      // «مدرب خارجي» عنصر اختياري يُنشأ معطّلاً، فيُفعَّل هنا إن اختاره المنسق
      if (id && form.externalTrainer) {
        try {
          const c = await api.get(`/courses/${id}`);
          const tr = (c?.data?.closureElements || []).find((el) => el.element?.key === 'external_trainer');
          if (tr) await api.post(`/courses/${id}/toggle-element`, { trackingId: tr.id, enabled: true });
        } catch {
          toast.error('أُنشئت الدورة، وتعذّر تفعيل «مدرب خارجي» — فعّله من صفحة الدورة');
        }
      }
      router.push(id ? `/courses/${id}` : '/courses');
    } catch (err) {
      toast.error(err?.response?.data?.message || t('course.form.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  if (!user) return null;

  const sDate = form.startDate ? new Date(form.startDate) : null;
  const eDate = form.endDate ? new Date(form.endDate) : null;

  return (
    <MainLayout breadcrumb={[{ label: t('nav.courses'), href: '/courses' }, { label: t('course.form.createTitle') }]}>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-primary">{t('course.form.createTitle')}</h1>
              <p className="mt-0.5 text-xs text-text-soft">{t('course.form.createSubtitle')}</p>
            </div>
            <button
              onClick={() => router.push('/courses')}
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
                <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder={t('course.form.namePlaceholder')} className={inputCls} />
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
                <input value={form.city} onChange={(e) => set('city', e.target.value)} required
                  placeholder={t('course.form.cityPlaceholder')} className={inputCls} />
              </Field>
              <Field label={t('course.form.project')} required>
                <select value={form.operationalProjectId} onChange={(e) => pickProject(e.target.value)} required className={inputCls}>
                  <option value="">{t('course.form.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {isCrossProject && (
                  <div className="mt-2 rounded-xl border border-accent/30 bg-forest-50 px-3 py-2 text-xs">
                    <p className="mb-0.5 inline-flex items-center gap-1 font-bold text-accent">
                      <Sparkles size={13} aria-hidden="true" /> {t('course.form.crossProjectTitle')}
                    </p>
                    <p className="text-text-soft">{t('course.form.crossProjectDesc')}</p>
                  </div>
                )}
              </Field>
              <Field label="مجال الدورة" required={projectDomains.length > 0}>
                <select value={form.domainId} onChange={(e) => pickDomain(e.target.value)} className={inputCls}
                  required={projectDomains.length > 0} disabled={!allDomains.length}>
                  <option value="">{allDomains.length ? 'اختر المجال' : 'لا مجالات مسجّلة'}</option>
                  {projects.filter((p) => p.domains?.length).map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {p.domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-text-soft">اختيار المجال يحدد مشروع الدورة تلقائياً.</p>
              </Field>
              <Field label="نوع الشهادة" required span2>
                <div role="radiogroup" aria-label="نوع الشهادة" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CERTIFICATE_TYPES.map((c) => {
                    const on = form.certificateType === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pickCertificate(c.value)}
                        className={`rounded-xl border p-3 text-start transition ${on ? 'border-primary bg-primary-light/60 ring-1 ring-primary/30' : 'border-border bg-background hover:border-primary/30'}`}
                      >
                        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${on ? 'text-primary' : 'text-text-main'}`}>
                          <Award size={14} aria-hidden="true" /> {c.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-text-soft">{c.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label={t('course.form.dateRange')} required span2>
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
                <input type="number" min="1" value={form.numTrainees} onChange={(e) => set('numTrainees', e.target.value)} required placeholder={t('course.form.numTraineesPlaceholder')} className={inputCls} />
              </Field>
            </div>

            {/* الإدخال المتأخر — الدورة تُضاف في كل حال، والمبرر إلزامي */}
            {lateness.isLate && (
              <div className="mt-4 rounded-xl border border-sand/50 bg-sand/10 p-4">
                <p className="flex items-center gap-2 text-sm font-extrabold text-warning">
                  <AlertTriangle size={16} aria-hidden="true" />
                  هذه الدورة تُدخَل متأخرة بـ{lateness.days} يوم
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-soft">
                  الدورة ستُضاف على كل حال — لا نمنع الإدخال أبداً. لكن التأخير
                  مسجّل، ويُعرض المبرر على المدير: إن قبله فلا تُسجَّل عليك ملاحظة
                  ولا تُحتسب العناصر التي فات موعدها قبل الإدخال، وإن رفضه تُسجَّل
                  نقطة على الانضباط.
                </p>
                <textarea
                  value={form.lateEntryReason}
                  onChange={(e) => set('lateEntryReason', e.target.value)}
                  rows={3}
                  maxLength={600}
                  placeholder="ما سبب تأخر إدخال الدورة؟ اذكر التفصيل — هذا ما سيراه المدير."
                  className="mt-3 w-full resize-none rounded-lg border border-sand/40 bg-white p-2.5 text-sm text-text-main outline-none focus:border-primary"
                />
                <p className="mt-1 text-end text-[11px] text-text-soft">
                  {form.lateEntryReason.trim().length < 10
                    ? 'المبرر مطلوب (10 أحرف على الأقل)'
                    : `${form.lateEntryReason.length}/600`}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="mb-1 inline-flex items-center gap-2 font-extrabold text-text-main">
              <Settings size={18} aria-hidden="true" className="text-primary" /> {t('course.form.opSettings')}
            </h2>
            <p className="mb-4 text-xs text-text-soft">{t('course.form.opSettingsDescCreate')}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {/* التسوية تتبع السلفة حتماً، فلا تُعرض خياراً مستقلاً يُنسى */}
              <Toggle
                label={t('course.form.requiresAdvance')}
                desc={t('course.form.requiresAdvanceWithSettlementDesc')}
                checked={form.requiresAdvance}
                onChange={(v) => set('requiresAdvance', v)}
              />
              <Toggle label={t('course.form.requiresRevenue')} desc={t('course.form.requiresRevenueDesc')} checked={form.requiresRevenue} onChange={(v) => set('requiresRevenue', v)} />
              <Toggle label={t('course.form.materialsIssued')} desc={t('course.form.materialsIssuedDesc')} checked={form.materialsIssued} onChange={(v) => set('materialsIssued', v)} />
              <Toggle label={t('course.form.requiresSupervisorCompensation')} desc={t('course.form.requiresSupervisorCompensationDesc')} critical checked={form.requiresSupervisorCompensation} onChange={(v) => set('requiresSupervisorCompensation', v)} />
              <Toggle label={t('course.form.requiresPreTest')}
                desc={form.certificateType === 'ATTENDANCE' ? 'شهادة حضور — لا اختبارات فيها.' : t('course.form.requiresPreTestDesc')}
                disabled={form.certificateType === 'ATTENDANCE'}
                checked={form.requiresPreTest} onChange={(v) => set('requiresPreTest', v)} />
              <Toggle label={t('course.form.requiresPostTest')}
                desc={form.certificateType === 'PASS' ? 'شهادة اجتياز — الاختبار البعدي لازم.' : form.certificateType === 'ATTENDANCE' ? 'شهادة حضور — لا اختبارات فيها.' : t('course.form.requiresPostTestDesc')}
                disabled={['PASS', 'ATTENDANCE'].includes(form.certificateType)}
                checked={form.requiresPostTest} onChange={(v) => set('requiresPostTest', v)} />
              <Toggle
                label={t('course.form.requiresInterpreter')}
                desc={t('course.form.requiresInterpreterDesc')}
                checked={form.requiresInterpreter}
                onChange={(v) => {
                  set('requiresInterpreter', v);
                  if (!v) set('interpreterContractType', '');
                }}
              />
              <Toggle
                label="مدرب خارجي"
                desc="يفتح عنصر المدرب: التذاكر والاستقبال والإسكان"
                checked={form.externalTrainer}
                onChange={(v) => set('externalTrainer', v)}
              />
            </div>

            {form.requiresInterpreter && (
              <div className="mt-4 rounded-xl border border-primary/15 bg-primary-light/40 p-4">
                <p className="mb-1 text-sm font-extrabold text-text-main">{t('course.form.interpreterContractType')}</p>
                <p className="mb-3 text-xs text-text-soft">{t('course.form.interpreterContractTypeDesc')}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {INTERPRETER_TYPES.map((opt) => {
                    const active = form.interpreterContractType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('interpreterContractType', opt.value)}
                        aria-pressed={active}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                          active
                            ? 'border-primary bg-primary text-white shadow-card'
                            : 'border-border bg-white text-text-main hover:border-primary/40'
                        }`}
                      >
                        {t(`course.form.${opt.key}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-4 z-10">
            <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-deep backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-1 text-xs text-text-soft">
                  {canSubmit && <Check size={14} aria-hidden="true" className="text-accent" />}
                  {canSubmit ? t('course.form.readyCreate') : t('course.form.completeRequired')}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.push('/courses')} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-main hover:bg-background">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {saving ? t('course.form.creating') : (<><Plus size={16} aria-hidden="true" /> {t('course.form.createBtn')}</>)}
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
