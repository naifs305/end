import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, CheckCircle2, Camera, Image as ImageIcon, Trash2, Printer, Mail, Check } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { isAcceptableImageFile, normalizeImageFile } from '../../lib/clientImage';
import { useTranslation } from '../../lib/i18n';

const CATEGORY_KEYS = ['', 'operational', 'technical', 'financial', 'administrative', 'trainees', 'trainer'];
const PRIORITY_KEYS = ['', 'urgent', 'medium', 'low'];

function ReadOnlyField({ label, value }) {
  return <div className="rounded-2xl border border-border bg-white p-3"><div className="mb-1 text-[11px] font-bold text-text-soft">{label}</div><div className="break-words text-sm font-bold text-text-main">{value || '-'}</div></div>;
}

function TextField({ label, value, onChange, placeholder, type = 'text', hint, disabled }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold text-text-main">{label}</label>
      {hint && <p className="mb-1.5 text-[11px] text-text-soft">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background disabled:text-text-soft"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold text-text-main">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background disabled:text-text-soft"
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function AttachmentCard({ file, index, onRemove, t }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2">
      <img src={file.content} alt={file.name} className="mb-2 h-28 w-full rounded-xl object-cover" />
      <div className="mb-1 truncate text-xs font-medium text-text-main">{file.name}</div>
      <div className="mb-2 text-[11px] text-text-soft">{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div>
      {onRemove && (
        <button type="button" onClick={() => onRemove(index)} className="inline-flex items-center gap-1 text-xs font-bold text-danger hover:underline">
          <Trash2 size={12} aria-hidden="true" /> {t('common.delete')}
        </button>
      )}
    </div>
  );
}

export default function CourseNotesReportForm({ courseId, course, onClose }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';

  const [notes, setNotes] = useState('');
  const [attendanceCount, setAttendanceCount] = useState(course?.numTrainees != null ? String(course.numTrainees) : '');
  const [beneficiaryEntity, setBeneficiaryEntity] = useState(course?.beneficiaryEntity || '');
  const [executingPartner, setExecutingPartner] = useState('');
  const [additionalTrainers, setAdditionalTrainers] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('');
  const [attachments, setAttachments] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isArchived = !!submittedId;

  const categoryOptions = useMemo(
    () => CATEGORY_KEYS.map((value) => ({ value, label: t(`notesForm.categories.${value || 'none'}`) })),
    [t]
  );
  const priorityOptions = useMemo(
    () => PRIORITY_KEYS.map((value) => ({ value, label: t(`notesForm.priorities.${value || 'none'}`) })),
    [t]
  );

  const formatLocationType = (value) => {
    const map = {
      INTERNAL: t('notesForm.locationType.INTERNAL'),
      EXTERNAL: t('notesForm.locationType.EXTERNAL'),
      REMOTE: t('notesForm.locationType.REMOTE'),
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
      supervisor: `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
    };
  }, [course, dateLocale]);

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
      if (attachments.length + files.length > 6) {
        toast.error(t('notesForm.maxImages'));
        e.target.value = '';
        return;
      }
      const invalidFile = files.find((file) => !isAcceptableImageFile(file));
      if (invalidFile) {
        toast.error(t('notesForm.imagesOnly'));
        e.target.value = '';
        return;
      }
      const oversized = files.find((file) => file.size > 4 * 1024 * 1024);
      if (oversized) {
        toast.error(t('notesForm.imageTooLarge'));
        e.target.value = '';
        return;
      }
      const convertedFiles = await Promise.all(files.map(compressImage));
      setAttachments((prev) => [...prev, ...convertedFiles]);
      e.target.value = '';
    } catch {
      toast.error(t('notesForm.uploadFailed'));
    }
  };

  const handleRemoveAttachment = (index) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const buildPayload = () => ({
    notes: notes.trim(),
    attendanceCount: attendanceCount !== '' ? Number(attendanceCount) : null,
    beneficiaryEntity: beneficiaryEntity.trim(),
    executingPartner: executingPartner.trim(),
    additionalTrainers: additionalTrainers.trim(),
    category,
    priority,
    suggestedAction: suggestedAction.trim(),
    attachments,
  });

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error(t('notesForm.notesRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/courses/${courseId}/notes-report`, buildPayload());
      setSubmittedId(res.data?.id);
      toast.success(t('notesForm.submitSuccess'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('notesForm.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!submittedId) return;
    setPrinting(true);
    try {
      const res = await api.get(`/field-reports/${submittedId}/export`, {
        responseType: 'text', headers: { Accept: 'text/html' },
      });
      const w = window.open('', '_blank');
      if (!w) { toast.error(t('notesForm.popupBlocked')); return; }
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch {
      toast.error(t('notesForm.exportFailed'));
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadEml = async () => {
    if (!submittedId) return;
    setDownloading(true);
    try {
      const res = await api.get(`/field-reports/${submittedId}/export-eml`, {
        responseType: 'blob', headers: { Accept: 'message/rfc822' },
      });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = match?.[1] || 'notes-report.eml';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('notesForm.downloadSuccess'));
    } catch {
      toast.error(t('notesForm.emlFailed'));
    } finally {
      setDownloading(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="my-8 w-full max-w-5xl rounded-3xl border border-border bg-background p-4 shadow-deep">
        <div className="space-y-5">

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="inline-flex items-center gap-2 text-base font-extrabold text-primary">
                  <FileText size={18} aria-hidden="true" /> {t('notesForm.title')}
                </h3>
                <p className="mt-1 text-sm text-text-soft">
                  {t('notesForm.subtitle')}
                </p>
              </div>
              {isArchived && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-accent/30 bg-forest-50 px-3 py-1.5 text-xs font-extrabold text-accent">
                  <CheckCircle2 size={14} aria-hidden="true" /> {t('notesForm.archivedBadge')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyField label={t('notesForm.courseName')} value={courseInfo?.name} />
              <ReadOnlyField label={t('notesForm.courseCode')} value={courseInfo?.code} />
              <ReadOnlyField label={t('notesForm.project')} value={courseInfo?.project} />
              <ReadOnlyField label={t('notesForm.city')} value={courseInfo?.city} />
              <ReadOnlyField label={t('notesForm.location')} value={formatLocationType(courseInfo?.locationType)} />
              <ReadOnlyField label={t('notesForm.startDate')} value={courseInfo?.startDate} />
              <ReadOnlyField label={t('notesForm.endDate')} value={courseInfo?.endDate} />
              <ReadOnlyField label={t('notesForm.supervisor')} value={courseInfo?.supervisor} />
            </div>
          </div>

          {/* بيانات إضافية مهمة لاتخاذ القرار */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <h4 className="mb-1 text-base font-extrabold text-text-main">{t('notesForm.additionalDataTitle')}</h4>
            <p className="mb-4 text-[11px] text-text-soft">{t('notesForm.additionalDataHint')}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label={t('notesForm.actualAttendance')} type="number" value={attendanceCount} onChange={setAttendanceCount} placeholder={t('notesForm.attendancePlaceholder')} disabled={isArchived} />
              <TextField label={t('notesForm.beneficiaryEntity')} value={beneficiaryEntity} onChange={setBeneficiaryEntity} placeholder={t('notesForm.beneficiaryPlaceholder')} disabled={isArchived} />
              <TextField label={t('notesForm.executingPartner')} value={executingPartner} onChange={setExecutingPartner} placeholder={t('notesForm.partnerPlaceholder')} hint={t('notesForm.partnerHint')} disabled={isArchived} />
              <TextField label={t('notesForm.additionalTrainers')} value={additionalTrainers} onChange={setAdditionalTrainers} placeholder={t('notesForm.trainersPlaceholder')} hint={t('notesForm.trainersHint')} disabled={isArchived} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <label className="mb-1.5 block text-sm font-extrabold text-text-main">
              {t('notesForm.notesLabel')} <span className="text-danger">*</span>
            </label>
            <p className="mb-2 text-[11px] text-text-soft">{t('notesForm.notesHint')}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesForm.notesPlaceholder')}
              disabled={isArchived}
              className="min-h-[180px] w-full resize-y rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background disabled:text-text-soft"
            />
          </div>

          {/* تصنيف الملاحظة والإجراء المقترح */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <h4 className="mb-1 text-base font-extrabold text-text-main">{t('notesForm.classificationTitle')}</h4>
            <p className="mb-4 text-[11px] text-text-soft">{t('notesForm.classificationHint')}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label={t('notesForm.categoryLabel')} value={category} onChange={setCategory} options={categoryOptions} disabled={isArchived} />
              <SelectField label={t('notesForm.priorityLabel')} value={priority} onChange={setPriority} options={priorityOptions} disabled={isArchived} />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-extrabold text-text-main">{t('notesForm.suggestedActionLabel')}</label>
              <textarea
                value={suggestedAction}
                onChange={(e) => setSuggestedAction(e.target.value)}
                placeholder={t('notesForm.suggestedActionPlaceholder')}
                disabled={isArchived}
                className="min-h-[90px] w-full resize-y rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-background disabled:text-text-soft"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-extrabold text-text-main">{t('notesForm.photosTitle')}</h4>
              <span className="text-xs text-text-soft">{t('notesForm.photosHint')}</span>
            </div>
            {!isArchived && (
              <div className="mb-4 flex flex-wrap gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition">
                  <Camera size={16} aria-hidden="true" /> {t('notesForm.captureDirect')}
                  <input type="file" accept="image/*" capture="environment" multiple onChange={handleAttachmentsChange} className="hidden" />
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-2xl border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary-light transition">
                  <ImageIcon size={16} aria-hidden="true" /> {t('notesForm.chooseFromGallery')}
                  <input type="file" accept="image/*" multiple onChange={handleAttachmentsChange} className="hidden" />
                </label>
              </div>
            )}
            {attachments.length > 0
              ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{attachments.map((file, index) => <AttachmentCard key={`${file.name}-${index}`} file={file} index={index} onRemove={isArchived ? null : handleRemoveAttachment} t={t} />)}</div>
              : <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-text-soft">{t('notesForm.noAttachments')}</div>}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main transition hover:bg-background">{t('common.close')}</button>
            {isArchived ? (
              <>
                <button type="button" onClick={handlePrint} disabled={printing} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60">
                  {printing ? t('notesForm.preparing') : (<><Printer size={16} aria-hidden="true" /> {t('common.print')}</>)}
                </button>
                <button type="button" onClick={handleDownloadEml} disabled={downloading} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  {downloading ? t('notesForm.preparing') : (<><Mail size={16} aria-hidden="true" /> {t('notesForm.downloadEml')}</>)}
                </button>
              </>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? t('notesForm.sending') : (<><Check size={16} aria-hidden="true" /> {t('notesForm.submitArchive')}</>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
