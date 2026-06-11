import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

function ReadOnlyField({ label, value }) {
  return <div className="rounded-2xl border border-border bg-white p-3"><div className="mb-1 text-[11px] font-bold text-text-soft">{label}</div><div className="break-words text-sm font-bold text-text-main">{value || '-'}</div></div>;
}

function AttachmentCard({ file, index, onRemove }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2">
      <img src={file.content} alt={file.name} className="mb-2 h-28 w-full rounded-xl object-cover" />
      <div className="mb-1 truncate text-xs font-medium text-text-main">{file.name}</div>
      <div className="mb-2 text-[11px] text-text-soft">{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div>
      <button type="button" onClick={() => onRemove(index)} className="text-xs font-bold text-danger hover:underline">حذف</button>
    </div>
  );
}

function formatLocationType(value) {
  const map = { INTERNAL: 'داخلي', EXTERNAL: 'خارجي', REMOTE: 'عن بُعد' };
  return map[value] || value || '-';
}

export default function CourseNotesReportForm({ courseId, course, onClose }) {
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const courseInfo = useMemo(() => {
    if (!course) return null;
    return {
      name: course.name || '-',
      code: course.code || '-',
      project: course.operationalProject?.name || '-',
      city: course.city || '-',
      locationType: course.locationType || '-',
      startDate: course.startDate ? new Date(course.startDate).toLocaleDateString('ar-SA') : '-',
      endDate: course.endDate ? new Date(course.endDate).toLocaleDateString('ar-SA') : '-',
      supervisor: `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
    };
  }, [course]);

  const compressImage = (file) => new Promise((resolve, reject) => {
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
          name: file.name.replace(/\.[^.]+$/, '.jpg'),
          type: 'image/jpeg',
          size: Math.round((content.length * 3) / 4),
          content,
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleAttachmentsChange = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      if (attachments.length + files.length > 6) {
        toast.error('الحد الأقصى 6 صور فقط');
        e.target.value = '';
        return;
      }
      const invalidFile = files.find((file) => !file.type.startsWith('image/'));
      if (invalidFile) {
        toast.error('يسمح فقط برفع الصور');
        e.target.value = '';
        return;
      }
      const oversized = files.find((file) => file.size > 4 * 1024 * 1024);
      if (oversized) {
        toast.error('حجم الصورة الواحدة يجب ألا يتجاوز 4MB');
        e.target.value = '';
        return;
      }
      const convertedFiles = await Promise.all(files.map(compressImage));
      setAttachments((prev) => [...prev, ...convertedFiles]);
      e.target.value = '';
    } catch {
      toast.error('تعذر رفع الصور');
    }
  };

  const handleRemoveAttachment = (index) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!notes.trim()) {
      toast.error('يرجى كتابة الملاحظات قبل المتابعة');
      return false;
    }
    return true;
  };

  const buildPayload = () => ({ notes: notes.trim(), attachments });

  const handlePrint = async () => {
    if (!validate()) return;
    setPrinting(true);
    try {
      const res = await api.post(`/courses/${courseId}/notes-report/print`, buildPayload(), {
        responseType: 'text', headers: { Accept: 'text/html' },
      });
      const w = window.open('', '_blank');
      if (!w) { toast.error('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة'); return; }
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch {
      toast.error('تعذر إنشاء التقرير');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadEml = async () => {
    if (!validate()) return;
    setDownloading(true);
    try {
      const res = await api.post(`/courses/${courseId}/notes-report/eml`, buildPayload(), {
        responseType: 'blob', headers: { Accept: 'message/rfc822' },
      });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = match?.[1] || 'notes-report.eml';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('تم تنزيل ملف التقرير');
    } catch {
      toast.error('تعذر تنزيل ملف EML');
    } finally {
      setDownloading(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-5xl rounded-3xl border border-border bg-background p-4 shadow-deep">
        <div className="space-y-5">

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-extrabold text-primary">📝 تقرير ملاحظات عامة على الدورة</h3>
                <p className="mt-1 text-sm text-text-soft">
                  نموذج مفتوح لتسجيل أي ملاحظات أو مستجدات ميدانية أثناء تنفيذ الدورة، يمكن طباعته أو تنزيله كرسالة بريدية موجّهة لسعادة وكيل التدريب.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyField label="اسم الدورة" value={courseInfo?.name} />
              <ReadOnlyField label="كود الدورة" value={courseInfo?.code} />
              <ReadOnlyField label="المشروع التشغيلي" value={courseInfo?.project} />
              <ReadOnlyField label="المدينة" value={courseInfo?.city} />
              <ReadOnlyField label="مقر التنفيذ" value={formatLocationType(courseInfo?.locationType)} />
              <ReadOnlyField label="تاريخ البداية" value={courseInfo?.startDate} />
              <ReadOnlyField label="تاريخ النهاية" value={courseInfo?.endDate} />
              <ReadOnlyField label="المشرف / المنسق" value={courseInfo?.supervisor} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <label className="mb-1.5 block text-sm font-extrabold text-text-main">
              الملاحظات والمستجدات <span className="text-danger">*</span>
            </label>
            <p className="mb-2 text-[11px] text-text-soft">اكتب كل ملاحظة في سطر مستقل ليتم عرضها كنقاط منظمة في التقرير.</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={'مثال:\nتأخر وصول المواد التدريبية يوم الثلاثاء\nملاحظة على جاهزية القاعة...\nطلب من الجهة المستفيدة بخصوص...'}
              className="min-h-[220px] w-full resize-y rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-extrabold text-text-main">صور وملاحظات مصورة</h4>
              <span className="text-xs text-text-soft">اختياري — حتى 6 صور</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition">
                📷 تصوير مباشر
                <input type="file" accept="image/*" capture="environment" multiple onChange={handleAttachmentsChange} className="hidden" />
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-2xl border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary-light transition">
                🖼️ اختيار من المعرض
                <input type="file" accept="image/*" multiple onChange={handleAttachmentsChange} className="hidden" />
              </label>
            </div>
            {attachments.length > 0
              ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{attachments.map((file, index) => <AttachmentCard key={`${file.name}-${index}`} file={file} index={index} onRemove={handleRemoveAttachment} />)}</div>
              : <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-text-soft">لم يتم إرفاق أي صور حتى الآن</div>}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main transition hover:bg-background">إغلاق</button>
            <button type="button" onClick={handlePrint} disabled={printing} className="rounded-2xl border border-primary/30 bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60">
              {printing ? 'جاري التحضير...' : '🖨️ طباعة'}
            </button>
            <button type="button" onClick={handleDownloadEml} disabled={downloading} className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {downloading ? 'جاري التحضير...' : '📧 تنزيل كرسالة بريد (EML)'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
