// ======================================================================
// بطاقة نوع الشهادة في صفحة الدورة
// ----------------------------------------------------------------------
// المنسق هو المسؤول عن إصدار الشهادات، فيلزمه معرفة نوعها مبكراً:
//   • بانتظار التحديد: يؤكده هنا (حضور أو اجتياز) قبل إطلاق الشهادات،
//     فيُنجز عنصر التأكيد. ولا تُقدَّم الشهادات والنوع معلّق.
//   • مؤكَّد: يمكن تغييره إلى النوع الآخر بملاحظة، ويُسجَّل التغيير على
//     إدارة تصميم البرامج التدريبية، ولا يُحاسَب المنسق على اختبار استجدّ.
// ======================================================================
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Award, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../lib/axios';
import { CERTIFICATE_LABEL } from '../../lib/shared/certificateTypes';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' }) : '');

export default function CertificateTypeCard({ course, canEdit, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(null); // النوع المراد التغيير إليه بعد التأكيد
  const [note, setNote] = useState('');

  const type = course.certificateType || null;
  const confirmed = type === 'PASS' || type === 'ATTENDANCE';
  const closed = ['CLOSED', 'ARCHIVED'].includes(course.status);

  const save = async (next, withNote) => {
    setBusy(true);
    try {
      await api.put(`/courses/${course.id}/certificate-type`, { certificateType: next, ...(withNote ? { note: withNote } : {}) });
      toast.success(confirmed ? 'غُيّر نوع الشهادة، وسُجّل التغيير' : `نوع الشهادة: ${CERTIFICATE_LABEL[next]}`);
      setChanging(null);
      setNote('');
      onUpdated?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر حفظ نوع الشهادة');
    } finally {
      setBusy(false);
    }
  };

  const tone = !type ? 'border-border bg-background'
    : type === 'PENDING' ? 'border-sand/50 bg-sand/10'
      : 'border-primary/20 bg-primary-light/40';

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award size={16} aria-hidden="true" className="text-primary" />
          <span className="text-xs font-extrabold text-text-main">نوع الشهادة:</span>
          <span className={`text-sm font-extrabold ${type === 'PENDING' ? 'text-warning' : 'text-primary'}`}>
            {type ? CERTIFICATE_LABEL[type] : 'غير مسجّل'}
          </span>
          {confirmed && course.certificateTypeConfirmedAt && (
            <span className="text-[11px] text-text-soft">· أُكّد {fmt(course.certificateTypeConfirmedAt)}</span>
          )}
          {course.certificateTypeChangeCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-burgundy/20 bg-burgundy/5 px-2 py-0.5 text-[10px] font-bold text-danger">
              <RefreshCw size={10} aria-hidden="true" /> تغيّر بعد التأكيد {course.certificateTypeChangeCount === 1 ? 'مرة' : `${course.certificateTypeChangeCount} مرات`}
            </span>
          )}
        </div>

        {canEdit && !closed && !changing && (
          <div className="flex flex-wrap gap-1.5">
            {!confirmed ? (
              ['PASS', 'ATTENDANCE'].map((v) => (
                <button key={v} type="button" disabled={busy} onClick={() => save(v)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
                  تأكيد: {CERTIFICATE_LABEL[v]}
                </button>
              ))
            ) : (
              <button type="button" disabled={busy} onClick={() => setChanging(type === 'PASS' ? 'ATTENDANCE' : 'PASS')}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50">
                تغيير إلى {CERTIFICATE_LABEL[type === 'PASS' ? 'ATTENDANCE' : 'PASS']}
              </button>
            )}
            {!type && (
              <button type="button" disabled={busy} onClick={() => save('PENDING')}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-soft transition hover:bg-background disabled:opacity-50">
                بانتظار التحديد
              </button>
            )}
          </div>
        )}
      </div>

      {type === 'PENDING' && (
        <p className="mt-1.5 text-[11px] leading-5 text-text-soft">
          أكّده قبل إطلاق الشهادات: يُستحسن بنهاية الدورة، والحد الأقصى بعدها بثلاثة أيام عمل. ولا تُقدَّم الشهادات قبل تأكيده. وإن تأخرت إدارة تصميم البرامج التدريبية في تحديده فارفع بلاغ عائق «بانتظار تحديد نوع الشهادة» على عنصر التأكيد، فتتوقف ساعته ويُسجَّل التأخير على الإدارة.
        </p>
      )}

      {changing && (
        <div className="mt-2 space-y-2 rounded-lg border border-burgundy/20 bg-white p-3">
          <p className="inline-flex items-start gap-1.5 text-[11px] leading-5 text-danger">
            <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
            تغيير النوع بعد تأكيده يُسجَّل على إدارة تصميم البرامج التدريبية ويُبلَّغ به مشرف الدورة.
            {changing === 'PASS' ? ' وسيُفتح الاختبار البعدي، ولا تُحاسَب على توقيته إن لم تبقَ مهلة كافية.' : ' وستسقط الاختبارات التي لم تُعتمد.'}
          </p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
            placeholder="سبب التغيير ومن أبلغك به (اختياري)"
            className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary" />
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => save(changing, note.trim())}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              {busy ? 'جارٍ الحفظ…' : `تأكيد التغيير إلى ${CERTIFICATE_LABEL[changing]}`}
            </button>
            <button type="button" disabled={busy} onClick={() => { setChanging(null); setNote(''); }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-soft">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
