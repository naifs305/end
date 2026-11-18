// ======================================================================
// مراجعة الشهادات بعين ثانية — داخل بطاقة «إصدار الشهادات»
// ----------------------------------------------------------------------
// المنسق: يرفق الشهادات (أو رابطها) ويختار زميلاً يراجعها فيُشعَر الزميل.
// والمرفقات تُحذف من المنصة تلقائياً بعد أن يؤكد المراجِع سلامتها.
// المراجِع: يؤكد المراجعة أو يعيدها بملاحظات. ولا يُقدَّم العنصر قبل التأكيد.
// ======================================================================
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserCheck, Send, Check, CornerUpLeft, ExternalLink, Clock, AlertTriangle, Paperclip, FileText, Trash2, Upload } from 'lucide-react';
import api from '../../lib/axios';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) : '');
const inputCls = 'w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary';

export default function CertReviewPanel({ trackingId, onChange }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ reviewerId: '', link: '', note: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => api.get(`/closure/${trackingId}/cert-review`)
    .then((r) => { const d = r?.data?.data ?? r?.data; setData(d); setForm((f) => ({ ...f, link: d.review?.link || f.link })); })
    .catch(() => setData(null));
  useEffect(() => { load(); }, [trackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || (!data.canAssign && !data.isReviewer && !data.review)) return null;
  const r = data.review;
  const files = data.files || [];
  const canUpload = data.canAssign && r?.status !== 'CONFIRMED';

  const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const upload = async (list) => {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    setUploading(true);
    try {
      for (const f of chosen) {
        if (f.size > 8 * 1024 * 1024) { toast.error(`«${f.name}» أكبر من ٨ ميجابايت`); continue; }
        await api.post(`/closure/${trackingId}/cert-review-file`, { name: f.name, dataUrl: await readAsDataUrl(f) });
      }
      toast.success('أُرفقت الشهادات');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر رفع الملف');
    } finally { setUploading(false); }
  };

  const openFile = async (f) => {
    try {
      const res = await api.get(`/closure/${trackingId}/cert-review-file`, { params: { key: f.key }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('تعذّر فتح الملف');
    }
  };

  const removeFile = async (f) => {
    try {
      await api.delete(`/closure/${trackingId}/cert-review-file`, { params: { key: f.key } });
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'تعذّر حذف الملف'); }
  };

  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`);
  const filesBlock = (files.length > 0 || canUpload) && (
    <div className="mb-2 rounded-lg border border-border bg-white p-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 font-bold text-text-main"><Paperclip size={13} aria-hidden="true" /> الشهادات المرفقة للمراجعة</p>
      {files.length === 0 ? (
        <p className="text-text-soft">لا مرفقات بعد — أرفق ملف الشهادات (PDF أو صور) أو ضع رابطها.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => openFile(f)} className="inline-flex min-w-0 items-center gap-1 font-bold text-primary hover:underline">
                <FileText size={12} aria-hidden="true" /> <span className="truncate">{f.name}</span>
              </button>
              <span className="flex shrink-0 items-center gap-2 text-text-soft">
                {kb(f.size)}
                {canUpload && <button type="button" onClick={() => removeFile(f)} aria-label={`حذف ${f.name}`} className="hover:text-danger"><Trash2 size={12} aria-hidden="true" /></button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <label className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-2.5 py-1.5 font-bold text-primary hover:bg-primary-light ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <Upload size={12} aria-hidden="true" /> {uploading ? 'جارٍ الرفع…' : 'إرفاق ملفات'}
          <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      <p className="mt-1.5 text-[10px] text-text-soft">تُحذف المرفقات من المنصة تلقائياً بعد أن يؤكد المراجِع سلامة الشهادات.</p>
    </div>
  );
  const pastNotes = (r?.history || []).filter((h) => h.type === 'returned' && h.note);

  const post = async (body, okMsg) => {
    setBusy(true);
    try {
      await api.post(`/closure/${trackingId}/cert-review`, body);
      toast.success(okMsg);
      setEditing(false); setReply('');
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
    } finally { setBusy(false); }
  };

  const assignForm = (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })} aria-label="المنسق المراجِع" className={inputCls}>
          <option value="">اختر المنسق المراجِع…</option>
          {data.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} dir="ltr" placeholder="رابط ملف الشهادات (اختياري)" className={inputCls} />
      </div>
      <input value={form.note} maxLength={600} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ملاحظة للمراجِع (اختياري)" className={inputCls} />
      <button type="button" disabled={busy || !form.reviewerId || (!form.link.trim() && files.length === 0)} title={!form.link.trim() && files.length === 0 ? 'أرفق الشهادات أو ضع رابطها أولاً' : undefined} onClick={() => post({ action: 'assign', ...form }, 'أُرسلت الشهادات للمراجعة')}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50">
        <Send size={13} aria-hidden="true" /> {r?.status === 'RETURNED' ? 'إعادة الإرسال للمراجعة' : 'إسناد المراجعة'}
      </button>
    </div>
  );

  return (
    <div className="order-last w-full rounded-xl border border-primary/20 bg-primary-light/30 p-3 text-xs">
      <p className="mb-2 flex items-center gap-1.5 font-extrabold text-text-main"><UserCheck size={14} aria-hidden="true" className="text-primary" /> مراجعة الشهادات قبل التقديم</p>
      {filesBlock}
      {pastNotes.length > 1 && (
        <details className="mb-2 rounded-lg bg-white p-2">
          <summary className="cursor-pointer font-bold text-text-soft">ملاحظات الجولات السابقة ({pastNotes.length})</summary>
          <ul className="mt-1 space-y-1">{pastNotes.map((h, i) => <li key={i} className="text-text-main">• الجولة {h.round}: {h.note} <span className="text-text-soft">({fmt(h.at)})</span></li>)}</ul>
        </details>
      )}

      {!r && data.canAssign && (
        <>
          <p className="mb-2 text-text-soft">لا تُقدَّم الشهادات قبل أن يراجعها منسق آخر ويؤكد مراجعتها.</p>
          {assignForm}
        </>
      )}

      {r?.status === 'ASSIGNED' && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-bold text-warning"><Clock size={13} aria-hidden="true" /> بانتظار مراجعة {r.reviewerName} منذ {fmt(r.assignedAt)}</p>
          {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="me-4 inline-flex items-center gap-1 font-bold text-primary hover:underline"><ExternalLink size={12} aria-hidden="true" /> ملف الشهادات</a>}
          {r.note && <p className="text-text-soft">ملاحظة المنسق: {r.note}</p>}
          {data.canRespond && (
            <div className="space-y-2 rounded-lg bg-white p-2.5">
              <p className="font-bold text-text-main">أُسندت إليك مراجعة هذه الشهادات</p>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={1000} placeholder="ملاحظاتك (مطلوبة عند الإعادة)" className={`${inputCls} resize-none`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => post({ action: 'respond', decision: 'confirm', note: reply }, 'أُكّدت مراجعة الشهادات')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-bold text-white hover:bg-primary-dark disabled:opacity-50">
                  <Check size={13} aria-hidden="true" /> راجعتها وهي سليمة
                </button>
                <button type="button" disabled={busy || reply.trim().length < 3} onClick={() => post({ action: 'respond', decision: 'return', note: reply }, 'أُعيدت الشهادات بملاحظاتك')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 font-bold text-text-main hover:bg-background disabled:opacity-50">
                  <CornerUpLeft size={13} aria-hidden="true" /> إعادة بملاحظات
                </button>
              </div>
            </div>
          )}
          {data.canAssign && (editing ? assignForm : (
            <button type="button" onClick={() => setEditing(true)} className="font-bold text-text-soft hover:text-primary">تغيير المراجِع</button>
          ))}
        </div>
      )}

      {r?.status === 'RETURNED' && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 font-bold text-danger"><AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> أعادها {r.reviewerName} بملاحظات: {r.reviewerNote}</p>
          {data.canAssign && <><p className="text-text-soft">صحّح الشهادات ثم أعد إرسالها للمراجعة.</p>{assignForm}</>}
        </div>
      )}

      {r?.status === 'CONFIRMED' && (
        <p className="flex items-center gap-1.5 font-bold text-success">
          <Check size={13} aria-hidden="true" /> راجعها {r.reviewerName} وأكّد سلامتها في {fmt(r.respondedAt)}{r.reviewerNote ? ` — ${r.reviewerNote}` : ''}
        </p>
      )}
    </div>
  );
}
