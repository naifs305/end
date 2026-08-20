import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ArrowLeft, Trash2, Check } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { isAcceptableImageFile, normalizeImageFile } from '../../lib/clientImage';
import { useTranslation } from '../../lib/i18n';

const RATING_VALUES = ['excellent', 'good', 'needs_improvement', 'weak', 'requires_development', 'not_applicable'];

const ratingValuesRequiringComment = ['needs_improvement', 'weak', 'requires_development'];

const SECTION_KEYS = [
  'training_environment',
  'trainer_evaluation',
  'trainee_evaluation',
  'content_evaluation',
  'lms_evaluation',
  'support_services_evaluation',
];

function emptySection() {
  return { rating: '', comment: '' };
}

function getInitialForm(reportType) {
  if (reportType === 'opening_report') {
    return {
      training_environment: emptySection(),
      trainer_evaluation: emptySection(),
      trainee_evaluation: emptySection(),
      content_evaluation: emptySection(),
      lms_evaluation: emptySection(),
      support_services_evaluation: emptySection(),
      registered_trainees_count: '',
      initial_attendance_count: '',
      trainers_count: '',
      translators_count: '',
      readiness_notes: '',
      declarationConfirmed: false,
      attachments: [],
    };
  }

  return {
    training_environment: emptySection(),
    trainer_evaluation: emptySection(),
    trainee_evaluation: emptySection(),
    content_evaluation: emptySection(),
    lms_evaluation: emptySection(),
    support_services_evaluation: emptySection(),
    registered_trainees_count: '',
    actual_attendance_count: '',
    trainers_count: '',
    translators_count: '',
    passed_count: '',
    failed_count: '',
    recommendations: '',
    declarationConfirmed: false,
    attachments: [],
  };
}

function RatingBadgePreview({ value, t }) {
  if (!value) return null;
  const map = {
    excellent:            'bg-forest-50 text-accent border-accent/20',
    good:                 'bg-primary-light text-primary border-primary/20',
    needs_improvement:    'bg-sand/20 text-warning border-sand/40',
    weak:                 'bg-burgundy/10 text-danger border-burgundy/20',
    requires_development: 'bg-sand/10 text-warning border-sand/30',
    not_applicable:       'bg-background text-text-soft border-border',
  };
  const label = t(`reportForm.ratings.${value}`);
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${map[value] || 'bg-background text-text-soft border-border'}`}>{label}</span>;
}

function Section({ title, name, data, onChange, required = false, helperItems = [], t }) {
  const needsComment = ratingValuesRequiringComment.includes(data?.rating || '');
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-extrabold text-text-main">{title}{required ? <span className="ms-1 text-danger">*</span> : null}</h4>
          <RatingBadgePreview value={data?.rating} t={t} />
        </div>
        {helperItems.length > 0 && (
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-2 text-xs font-bold text-text-main">{t('reportForm.suggestedAxes')}</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {helperItems.map((item, index) => (
                <div key={`${name}-guide-${index}`} className="flex items-start gap-2 text-xs text-text-soft">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="mb-1.5 block text-xs font-bold text-text-soft">{t('reportForm.overallRating')}{required ? <span className="ms-1 text-danger">*</span> : null}</label>
          <select name={`${name}.rating`} value={data?.rating || ''} onChange={onChange} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" required={required}>
            <option value="">{t('reportForm.selectRating')}</option>
            {RATING_VALUES.map((r) => <option key={r} value={r}>{t(`reportForm.ratings.${r}`)}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1.5 block text-xs font-bold text-text-soft">{t('reportForm.detailedDescription')}{needsComment ? <span className="ms-1 text-danger">*</span> : null}</label>
          <textarea name={`${name}.comment`} value={data?.comment || ''} onChange={onChange} className="min-h-[120px] w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder={t('reportForm.commentPlaceholder')} required={needsComment} />
          <div className="mt-2 text-[11px] text-text-soft">{t('reportForm.commentRequiredHint')}</div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return <div className="rounded-2xl border border-border bg-white p-3"><div className="mb-1 text-[11px] font-bold text-text-soft">{label}</div><div className="break-words text-sm font-bold text-text-main">{value || '-'}</div></div>;
}

function AttachmentCard({ file, index, onRemove, t }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2">
      <img src={file.content} alt={file.name} className="mb-2 h-28 w-full rounded-xl object-cover" />
      <div className="mb-1 truncate text-xs font-medium text-text-main">{file.name}</div>
      <div className="mb-2 text-[11px] text-text-soft">{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div>
      <button type="button" onClick={() => onRemove(index)} className="inline-flex items-center gap-1 text-xs font-bold text-danger hover:underline">
        <Trash2 size={12} aria-hidden="true" /> {t('common.delete')}
      </button>
    </div>
  );
}

function TextField({ label, name, value, onChange, placeholder, required = false, type = 'text', min, disabled = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-text-soft">{label}{required ? <span className="ms-1 text-danger">*</span> : null}</label>
      <input type={type} min={min} name={name} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background" required={required} />
    </div>
  );
}

function TextAreaField({ label, name, value, onChange, placeholder, required = false, minHeight = '120px' }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-text-soft">{label}{required ? <span className="ms-1 text-danger">*</span> : null}</label>
      <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" style={{ minHeight }} required={required} />
    </div>
  );
}

export default function CourseReportForm({ trackingId, onClose, onSuccess, course, reportType = 'closing_report', delayReason = '', initialData = null }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
  const normalizedType = reportType === 'opening_report' ? 'opening_report' : 'closing_report';
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [form, setForm] = useState({ ...getInitialForm(normalizedType), ...(initialData || {}) });

  const guides = useMemo(() => {
    const prefix = normalizedType === 'opening_report' ? 'openingGuides' : 'closingGuides';
    const out = {};
    for (const key of SECTION_KEYS) {
      const items = t(`reportForm.${prefix}.${key}`);
      out[key] = Array.isArray(items) ? items : [];
    }
    return out;
  }, [normalizedType, t]);

  const formatLocationType = (value) => {
    const map = {
      INTERNAL: t('reportForm.locationType.INTERNAL'),
      EXTERNAL: t('reportForm.locationType.EXTERNAL'),
      REMOTE: t('reportForm.locationType.REMOTE'),
    };
    return map[value] || value || '-';
  };

  const courseInfo = useMemo(() => {
    if (!course) return null;
    return {
      name: course.name || '-',
      code: course.code || '-',
      project: course.operationalProject?.name || '-',
      city: course.city || '-',
      locationType: course.locationType || '-',
      startDate: course.startDate ? new Date(course.startDate).toLocaleDateString(dateLocale) : '-',
      endDate: course.endDate ? new Date(course.endDate).toLocaleDateString(dateLocale) : '-',
      traineesCount: course.numTrainees ?? '-',
      supervisor: `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
    };
  }, [course, dateLocale]);

  const attendanceRate = useMemo(() => {
    const registered = Number(form.registered_trainees_count);
    const actual = Number(normalizedType === 'opening_report' ? form.initial_attendance_count : form.actual_attendance_count);
    if (!registered || Number.isNaN(registered) || registered <= 0) return '';
    if (Number.isNaN(actual) || actual < 0) return '';
    return `${((actual / registered) * 100).toFixed(1)}%`;
  }, [form.registered_trainees_count, form.initial_attendance_count, form.actual_attendance_count, normalizedType]);

  const passingRate = useMemo(() => {
    if (normalizedType !== 'closing_report') return '';
    const attendance = Number(form.actual_attendance_count);
    const passed = Number(form.passed_count);
    if (!attendance || Number.isNaN(attendance) || attendance <= 0) return '';
    if (Number.isNaN(passed) || passed < 0) return '';
    return `${((passed / attendance) * 100).toFixed(1)}%`;
  }, [form.actual_attendance_count, form.passed_count, normalizedType]);

  const completionStats = useMemo(() => {
    const keys = SECTION_KEYS;
    const completed = keys.filter((key) => form[key]?.rating).length;
    return { completed, total: keys.length, percent: Math.round((completed / keys.length) * 100) };
  }, [form]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const parts = name.split('.');
    if (parts.length === 2) {
      const [section, field] = parts;
      setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const compressImage = async (file) => {
    const normalized = await normalizeImageFile(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1600;
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const content = canvas.toDataURL('image/jpeg', 0.72);
          resolve({
            name: normalized.name.replace(/\.[^.]+$/, '.jpg'),
            type: 'image/jpeg',
            size: Math.round((content.length * 3) / 4),
            content,
          });
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(normalized);
    });
  };

  const handleAttachmentsChange = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      if (form.attachments.length + files.length > 6) {
        toast.error(t('reportForm.maxImages'));
        e.target.value = '';
        return;
      }
      const invalidFile = files.find((file) => !isAcceptableImageFile(file));
      if (invalidFile) {
        toast.error(t('reportForm.imagesOnly'));
        e.target.value = '';
        return;
      }
      const oversized = files.find((file) => file.size > 4 * 1024 * 1024);
      if (oversized) {
        toast.error(t('reportForm.imageTooLarge'));
        e.target.value = '';
        return;
      }
      const convertedFiles = await Promise.all(files.map(compressImage));
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...convertedFiles] }));
      e.target.value = '';
    } catch {
      toast.error(t('reportForm.uploadFailed'));
    }
  };

  const handleRemoveAttachment = (index) => setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));

  const validateForm = () => {
    const requiredSections = SECTION_KEYS;

    for (const key of requiredSections) {
      const section = form[key];
      if (!section?.rating?.trim()) {
        toast.error(t('reportForm.completeAllRatings'));
        return false;
      }
      if (ratingValuesRequiringComment.includes(section.rating) && !section.comment?.trim()) {
        toast.error(t('reportForm.commentRequired'));
        return false;
      }
    }

    if (form.registered_trainees_count === '' || (normalizedType === 'opening_report' ? form.initial_attendance_count === '' : form.actual_attendance_count === '')) {
      toast.error(t('reportForm.completeAttendance'));
      return false;
    }

    if (!form.declarationConfirmed) {
      toast.error(t('reportForm.declarationRequired'));
      return false;
    }
    return true;
  };

  const [showPhotoReminder, setShowPhotoReminder] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // تذكير الصور — إذا لم يُرفق أي صورة
    if (form.attachments.length === 0 && !showPhotoReminder) {
      setShowPhotoReminder(true);
      return;
    }
    setShowPhotoReminder(false);
    await doSubmit();
  };

  const doSubmit = async () => {
    setLoading(true);
    try {
      const endpoint = normalizedType === 'opening_report'
        ? `/closure/${trackingId}/opening-report`
        : `/closure/${trackingId}/closing-report`;
      await api.post(endpoint, {
        ...form,
        attendance_rate: attendanceRate,
        passing_rate: passingRate,
        generatedCourseInfo: courseInfo,
        ...(delayReason.trim() ? { delayReason: delayReason.trim() } : {}),
      });
      toast.success(t('reportForm.submitSuccess'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await api.post(`/closure/${trackingId}/draft`, {
        ...form,
        attendance_rate: attendanceRate,
        passing_rate: passingRate,
        generatedCourseInfo: courseInfo,
      });
      toast.success(t('reportForm.draftSaved'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('reportForm.draftFailed'));
    } finally {
      setSavingDraft(false);
    }
  };

  const title = normalizedType === 'opening_report' ? t('reportForm.openingTitle') : t('reportForm.closingTitle');
  const subtitle = normalizedType === 'opening_report'
    ? t('reportForm.openingSubtitle')
    : t('reportForm.closingSubtitle');

  return (
    <>
    {/* نافذة تذكير الصور */}
    {showPhotoReminder && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-white shadow-deep">
          <div className="bg-sand/20 px-5 py-4 border-b border-sand/30">
            <div className="flex items-center gap-3">
              <Camera size={28} className="text-warning" aria-hidden="true" />
              <div>
                <h3 className="font-extrabold text-text-main">{t('reportForm.photoReminderTitle')}</h3>
                <p className="text-xs text-text-soft mt-0.5">{t('reportForm.photoReminderSubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-text-soft leading-relaxed">
              {t('reportForm.photoReminderBody')}
            </p>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={() => setShowPhotoReminder(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-sm font-bold text-text-main hover:bg-forest-50 transition"
            >
              <ArrowLeft size={16} aria-hidden="true" /> {t('reportForm.addPhotos')}
            </button>
            <button
              type="button"
              onClick={() => { setShowPhotoReminder(false); doSubmit(); }}
              className="flex-1 rounded-xl border border-sand/40 bg-sand/10 py-2.5 text-sm font-bold text-warning hover:bg-sand/20 transition"
            >
              {t('reportForm.sendWithoutPhotos')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-soft">{subtitle}</p>
          </div>
          <div className="min-w-[220px] rounded-3xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-text-soft">{t('reportForm.formCompletion')}</span><span className="text-sm font-extrabold text-primary">{completionStats.percent}%</span></div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${completionStats.percent}%` }} /></div>
            <div className="mt-2 text-[11px] text-text-soft">{t('reportForm.axesCompleted', { completed: completionStats.completed, total: completionStats.total })}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyField label={t('reportForm.courseName')} value={courseInfo?.name} />
          <ReadOnlyField label={t('reportForm.courseCode')} value={courseInfo?.code} />
          <ReadOnlyField label={t('reportForm.project')} value={courseInfo?.project} />
          <ReadOnlyField label={t('reportForm.city')} value={courseInfo?.city} />
          <ReadOnlyField label={t('reportForm.location')} value={formatLocationType(courseInfo?.locationType)} />
          <ReadOnlyField label={t('reportForm.startDate')} value={courseInfo?.startDate} />
          <ReadOnlyField label={t('reportForm.endDate')} value={courseInfo?.endDate} />
          <ReadOnlyField label={t('reportForm.traineesCount')} value={courseInfo?.traineesCount} />
          <ReadOnlyField label={t('reportForm.supervisor')} value={courseInfo?.supervisor} />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4"><h4 className="text-base font-extrabold text-text-main">{normalizedType === 'opening_report' ? t('reportForm.openingStats') : t('reportForm.closingStats')}</h4></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TextField label={t('reportForm.registeredCount')} name="registered_trainees_count" value={form.registered_trainees_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 14 })} type="number" min="0" required />
          {normalizedType === 'opening_report' ? (
            <TextField label={t('reportForm.firstDayAttendance')} name="initial_attendance_count" value={form.initial_attendance_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 14 })} type="number" min="0" required />
          ) : (
            <TextField label={t('reportForm.actualAttendance')} name="actual_attendance_count" value={form.actual_attendance_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 14 })} type="number" min="0" required />
          )}
          <TextField label={t('reportForm.trainersCount')} name="trainers_count" value={form.trainers_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 3 })} type="number" min="0" />
          <TextField label={t('reportForm.translatorsCount')} name="translators_count" value={form.translators_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 1 })} type="number" min="0" />
          <TextField label={normalizedType === 'opening_report' ? t('reportForm.initialAttendanceRate') : t('reportForm.attendanceRate')} name="attendance_rate_preview" value={attendanceRate} onChange={() => {}} disabled />
          {normalizedType === 'closing_report' && (
            <>
              <TextField label={t('reportForm.passedCount')} name="passed_count" value={form.passed_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 12 })} type="number" min="0" />
              <TextField label={t('reportForm.failedCount')} name="failed_count" value={form.failed_count} onChange={handleChange} placeholder={t('reportForm.exampleCount', { n: 2 })} type="number" min="0" />
              <TextField label={t('reportForm.passingRate')} name="passing_rate_preview" value={passingRate} onChange={() => {}} disabled />
            </>
          )}
        </div>
      </div>

      <Section title={t('reportForm.sections.training_environment')} name="training_environment" data={form.training_environment} onChange={handleChange} required helperItems={guides.training_environment} t={t} />
      <Section title={t('reportForm.sections.trainer_evaluation')} name="trainer_evaluation" data={form.trainer_evaluation} onChange={handleChange} required helperItems={guides.trainer_evaluation} t={t} />
      <Section title={t('reportForm.sections.trainee_evaluation')} name="trainee_evaluation" data={form.trainee_evaluation} onChange={handleChange} required helperItems={guides.trainee_evaluation} t={t} />
      <Section title={t('reportForm.sections.content_evaluation')} name="content_evaluation" data={form.content_evaluation} onChange={handleChange} required helperItems={guides.content_evaluation} t={t} />
      <Section title={t('reportForm.sections.lms_evaluation')} name="lms_evaluation" data={form.lms_evaluation} onChange={handleChange} required helperItems={guides.lms_evaluation} t={t} />
      <Section title={t('reportForm.sections.support_services_evaluation')} name="support_services_evaluation" data={form.support_services_evaluation} onChange={handleChange} required helperItems={guides.support_services_evaluation} t={t} />

      {normalizedType === 'opening_report' ? (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
          <TextAreaField label={t('reportForm.readinessNotes')} name="readiness_notes" value={form.readiness_notes} onChange={handleChange} placeholder={t('reportForm.readinessNotesPlaceholder')} minHeight="140px" />
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
          <TextAreaField label={t('reportForm.recommendations')} name="recommendations" value={form.recommendations} onChange={handleChange} placeholder={t('reportForm.recommendationsPlaceholder')} minHeight="140px" />
        </div>
      )}

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between"><h4 className="text-base font-extrabold text-text-main">{t('reportForm.attachmentsTitle')}</h4><span className="text-xs text-text-soft">{t('reportForm.attachmentsHint')}</span></div>
        <div className="mb-4"><input type="file" accept="image/*" multiple onChange={handleAttachmentsChange} className="block w-full text-sm text-text-soft file:me-4 file:rounded-2xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:opacity-90" /></div>
        {form.attachments.length > 0 ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{form.attachments.map((file, index) => <AttachmentCard key={`${file.name}-${index}`} file={file} index={index} onRemove={handleRemoveAttachment} t={t} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-text-soft">{t('reportForm.noAttachments')}</div>}
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        <label className="flex items-start gap-3 text-sm text-text-main">
          <input type="checkbox" name="declarationConfirmed" checked={form.declarationConfirmed} onChange={handleChange} className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary" />
          <span>{t('reportForm.declaration')}</span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
        <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main transition hover:bg-background">{t('common.close')}</button>
        <button type="button" onClick={handleSaveDraft} disabled={savingDraft || loading} className="rounded-2xl border border-primary/30 bg-primary-light px-5 py-3 text-sm font-bold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{savingDraft ? t('common.saving') : t('reportForm.saveAsDraft')}</button>
        <button type="submit" disabled={loading || savingDraft} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? t('common.saving') : (<><Check size={16} aria-hidden="true" /> {t('reportForm.saveAndSubmit')}</>)}
        </button>
      </div>
    </form>
    </>
  );
}
