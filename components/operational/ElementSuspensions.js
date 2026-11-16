import { useState, useEffect, useCallback } from 'react';
import { OctagonPause, PlayCircle, Plus, X, CalendarClock } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

// ======================================================================
// فترات إيقاف عناصر الإقفال
// ----------------------------------------------------------------------
// إيقاف إجراء كالتأمين الطبي قرار مؤسسي لفترة، لا قرار دورة بدورة
// ولا مفتاح بيد المنسق. المدير يسجّل الفترة فيسقط العنصر عن كل دورة
// تبدأ داخلها — والدورات المفتوحة تُحدَّث معها. والمنسق لا يفعل شيئاً:
// لا نسيان ولا خطأ ولا تلاعب، والسجل يبيّن بعد سنتين لماذا سقط.
// ======================================================================

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function ElementSuspensions({ elements }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [elementId, setElementId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/closure-elements/suspensions');
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!elementId) return toast.error('اختر العنصر');
    if (!startsAt) return toast.error('حدّد تاريخ بداية الإيقاف');
    if (reason.trim().length < 5) return toast.error('اكتب سبب الإيقاف');

    setBusy(true);
    try {
      const res = await api.post('/closure-elements/suspensions', {
        elementId, startsAt, endsAt: endsAt || null, reason: reason.trim(),
      });
      const affected = res.data?.affectedCourses ?? 0;
      toast.success(
        affected > 0
          ? `فُتحت فترة الإيقاف — سقط العنصر عن ${affected} دورة مفتوحة`
          : 'فُتحت فترة الإيقاف',
      );
      setFormOpen(false);
      setElementId(''); setStartsAt(''); setEndsAt(''); setReason('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر فتح فترة الإيقاف');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(id) {
    setBusy(true);
    try {
      const res = await api.post(`/closure-elements/suspensions/${id}/close`, {});
      const restored = res.data?.restoredCourses ?? 0;
      toast.success(
        restored > 0
          ? `أُغلقت الفترة — عاد العنصر إلى ${restored} دورة`
          : 'أُغلقت فترة الإيقاف — العنصر يعود للدورات الجديدة',
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر إغلاق الفترة');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-white p-2 text-sm text-text-main outline-none focus:border-primary';

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-extrabold text-text-main">
          <OctagonPause size={18} aria-hidden="true" className="text-warning" />
          فترات إيقاف العناصر
        </h2>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            <Plus size={14} aria-hidden="true" /> فترة إيقاف جديدة
          </button>
        )}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-text-soft">
        حين يتوقّف إجراء مؤسسياً — كإيقاف إصدار التأمين الطبي — سجّل الفترة هنا.
        يسقط العنصر تلقائياً عن كل دورة تبدأ داخلها ولا يُحتسب على منسقيها،
        والدورات المفتوحة حالياً تُحدَّث معها. ولا يُطلب من المنسق فعل شيء.
      </p>

      {formOpen && (
        <div className="mb-4 space-y-3 rounded-xl border border-sand/50 bg-sand/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-text-main">فترة إيقاف جديدة</p>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="إغلاق" className="text-text-soft hover:text-danger">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div>
            <label htmlFor="susp-element" className="mb-1 block text-xs font-bold text-text-main">العنصر</label>
            <select id="susp-element" value={elementId} onChange={(e) => setElementId(e.target.value)} className={inputCls}>
              <option value="">— اختر العنصر —</option>
              {(elements || []).map((el) => <option key={el.id} value={el.id}>{el.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="susp-start" className="mb-1 block text-xs font-bold text-text-main">من تاريخ</label>
              <input id="susp-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="susp-end" className="mb-1 block text-xs font-bold text-text-main">
                إلى تاريخ <span className="font-normal text-text-soft">(اتركه فارغاً = إلى إشعار آخر)</span>
              </label>
              <input id="susp-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="susp-reason" className="mb-1 block text-xs font-bold text-text-main">سبب الإيقاف</label>
            <textarea
              id="susp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="يُحفظ في السجل ويبيّن بعد سنوات لماذا سقط العنصر عن دورات هذه الفترة"
              className={`${inputCls} resize-none`}
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="rounded-xl bg-warning px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            فتح فترة الإيقاف
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-soft">لا توجد فترات إيقاف مسجّلة</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3 ${
                s.isActive ? 'border-sand/50 bg-sand/10' : 'border-border bg-background'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-extrabold text-text-main">
                  {s.element?.name || '—'}
                  {s.isActive ? (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">سارية</span>
                  ) : (
                    <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-text-soft">منتهية</span>
                  )}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-soft">
                  <CalendarClock size={12} aria-hidden="true" />
                  من {fmt(s.startsAt)} إلى {s.endsAt ? fmt(s.endsAt) : 'إشعار آخر'}
                  {s._count?.trackings > 0 && ` · أسقطت العنصر عن ${s._count.trackings} دورة`}
                </p>
                <p className="mt-1 text-[11px] text-text-main">{s.reason}</p>
              </div>
              {s.isActive && (
                <button
                  type="button"
                  onClick={() => handleClose(s.id)}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  <PlayCircle size={13} aria-hidden="true" /> عاد الإجراء
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
