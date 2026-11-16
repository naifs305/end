// ======================================================================
// نموذج «دليل السفر التعريفي»
// ----------------------------------------------------------------------
// إجراءان: تقديم رابط الدليل للاعتماد، أو — إن لم يوجد دليل للمدينة —
// إخراج رسالة لمدير الإدارة بطلب تصميم دليل جديد باسم المدينة، مع تذكير
// المنسق بإرفاق ملف المعلومات المراد إدراجها.
// ======================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Map as MapIcon, X, ExternalLink, Save, Send, Mail, Paperclip, Check, Clock, AlertTriangle, Link2, FilePlus2 } from 'lucide-react';
import api from '../../lib/axios';

export const PLANNER_URL = 'https://nauss-journey-planner.lovable.app/';
const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-background';
const EMPTY = { mode: 'existing', url: '', city: '', note: '', requestedAt: null };

// mode يأتي من زر البطاقة: «تقديم الدليل» (existing) أو «طلب دليل» (request)
export default function TravelGuideForm({ trackingId, onClose, onSuccess, readOnly = false, mode: fixedMode = null }) {
  const [form, setForm] = useState(EMPTY);
  const [course, setCourse] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/closure/${trackingId}/travel-guide`).then((r) => {
      if (!alive) return;
      const d = r?.data?.data ?? r?.data;
      setForm({ ...EMPTY, city: d.course?.city || '', ...(d.guide || {}), ...(fixedMode ? { mode: fixedMode } : {}) });
      setCourse(d.course);
      setCanEdit(!!d.canEdit && !readOnly);
    }).catch((e) => toast.error(e?.response?.data?.message || 'تعذّر تحميل دليل السفر')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [trackingId, readOnly, fixedMode]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const disabled = !canEdit;
  const urlOk = /^https?:\/\/\S+\.\S+/i.test(form.url.trim());
  const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) : '');

  const save = async (quiet = false) => {
    setSaving(true);
    try {
      const r = await api.put(`/closure/${trackingId}/travel-guide`, form);
      const d = r?.data?.data ?? r?.data;
      setForm((f) => ({ ...f, ...d.guide })); setDirty(false);
      if (!quiet) toast.success('حُفظ');
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
      return false;
    } finally { setSaving(false); }
  };

  const downloadRequest = async () => {
    setReminder(false);
    if (dirty && !(await save(true))) return;
    try {
      const res = await api.get(`/closure/${trackingId}/travel-guide`, { params: { output: 'request' }, responseType: 'blob', headers: { Accept: 'message/rfc822' } });
      const match = (res.headers['content-disposition'] || '').match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = match?.[1] || 'travel-guide-request.eml';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setForm((f) => ({ ...f, mode: 'request', requestedAt: new Date().toISOString() }));
      toast.success('نُزِّلت الرسالة — أرفق ملف المعلومات ثم أرسلها');
    } catch (err) {
      const blob = err?.response?.data;
      let msg = 'تعذّر إخراج الرسالة';
      if (blob instanceof Blob) { try { msg = JSON.parse(await blob.text()).message || msg; } catch { /* نص غير مقروء */ } }
      toast.error(msg);
    }
  };

  const submit = async () => {
    if (!urlOk) { toast.error('أدخل رابط الدليل أولاً'); return; }
    if (dirty && !(await save(true))) return;
    setBusy(true);
    try {
      await api.put(`/closure/${trackingId}`, { status: 'PENDING_APPROVAL' });
      toast.success('قُدِّم دليل السفر للاعتماد');
      onSuccess?.(); onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر التقديم');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="rounded-3xl bg-white p-8 text-center text-sm text-text-soft">جارٍ التحميل…</div>;

  const city = form.city || course?.city || '';
  const choice = (mode, Icon, title, sub) => (
    <button type="button" disabled={disabled} onClick={() => set('mode', mode)} aria-pressed={form.mode === mode}
      className={`flex flex-1 items-start gap-2.5 rounded-2xl border-2 p-3.5 text-start transition ${form.mode === mode ? 'border-primary bg-primary-light/50' : 'border-border bg-white hover:border-primary/40'} disabled:cursor-default`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${form.mode === mode ? 'bg-primary text-white' : 'bg-background text-text-soft'}`}><Icon size={18} aria-hidden="true" /></span>
      <span><span className="block text-sm font-extrabold text-text-main">{title}</span><span className="block text-[12px] text-text-soft">{sub}</span></span>
    </button>
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-deep" dir="rtl">
      <div className="flex items-center gap-3 border-b border-border bg-white px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-light text-primary"><MapIcon size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-text-main">{fixedMode === 'request' ? 'طلب دليل سفر جديد' : fixedMode === 'existing' ? 'تقديم دليل السفر' : 'دليل السفر التعريفي'}</p>
          {course && <p className="truncate text-xs text-text-soft">{course.name}{city ? ` · ${city}` : ''}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full text-text-soft hover:bg-background"><X size={18} /></button>
      </div>

      <div className="space-y-4 p-5">
        {form.mode === 'existing' && <a href={PLANNER_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-[#0b3f42] px-4 py-3 text-white hover:bg-[#0e4c50]">
          <MapIcon size={20} aria-hidden="true" className="text-[#C6AA76]" />
          <span className="flex-1">
            <span className="block text-sm font-extrabold">منصة أدلة السفر</span>
            <span className="block text-[12px] text-white/75">ابحث فيها عن دليل {city ? `«${city}»` : 'مدينة التنفيذ'} وانسخ رابطه</span>
          </span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>}

        {!fixedMode && <div className="flex flex-col gap-2 sm:flex-row">
          {choice('existing', Link2, 'تقديم الدليل', 'الدليل موجود: أدخل رابطه وقدّمه للاعتماد')}
          {choice('request', FilePlus2, 'لا يوجد دليل', `طلب تصميم دليل جديد باسم ${city ? `«${city}»` : 'المدينة'}`)}
        </div>}

        {form.mode === 'existing' ? (
          <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-text-main">رابط دليل السفر</span>
              <input value={form.url} onChange={(e) => set('url', e.target.value)} disabled={disabled} dir="ltr" placeholder={`${PLANNER_URL}…`} className={inputCls} />
              {form.url && !urlOk && <span className="mt-1 block text-[11.5px] text-danger">رابط غير مكتمل — يبدأ بـ https://</span>}
            </label>
            {form.requestedAt && (
              <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-[12.5px] font-bold text-success">
                <Check size={14} aria-hidden="true" /> طُلب تصميم الدليل في {fmt(form.requestedAt)} — أدخل رابطه هنا حين يصلك
              </p>
            )}
            {form.url && urlOk && (
              <a href={form.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary hover:underline">
                <ExternalLink size={13} aria-hidden="true" /> معاينة الدليل
              </a>
            )}
          </section>
        ) : (
          <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <p className="flex items-start gap-2 rounded-xl bg-sand/15 px-3 py-2.5 text-[12.5px] text-text-main">
              <Paperclip size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
              تُوجَّه رسالة لمدير الإدارة بطلب تصميم دليل باسم المدينة، ولا بد أن ترفق بها ملفاً يتضمن المعلومات المراد إدراجها في الدليل.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-text-main">اسم المدينة في الدليل</span>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} disabled={disabled} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-text-main">ملاحظات للمصمم <span className="font-normal text-text-soft">— اختياري</span></span>
              <textarea value={form.note} rows={3} maxLength={1000} onChange={(e) => set('note', e.target.value)} disabled={disabled}
                placeholder="مثال: التركيز على المواصلات من المطار، والطقس في ديسمبر" className={inputCls} />
            </label>
            {form.requestedAt ? (
              <div className="space-y-1.5 rounded-xl bg-background px-3 py-2.5 text-[12.5px]">
                <p className="flex items-center gap-1.5 font-bold text-success"><Check size={14} aria-hidden="true" /> أُخرجت رسالة الطلب في {fmt(form.requestedAt)}</p>
                <p className="flex items-start gap-1.5 text-text-soft"><Clock size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> حين يصلك الدليل اضغط «تقديم الدليل» في بطاقة العنصر وأدخل رابطه.</p>
                <p className="flex items-start gap-1.5 text-text-soft"><AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> وإن تأخر فارفع «بلاغ عائق» من بطاقة العنصر في صفحة الدورة.</p>
              </div>
            ) : null}
            {canEdit && (
              <button type="button" onClick={() => setReminder(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary-light">
                <Mail size={15} aria-hidden="true" /> {form.requestedAt ? 'إخراج رسالة الطلب مرة أخرى' : 'إخراج رسالة الطلب لمدير الإدارة'}
              </button>
            )}
          </section>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background disabled:opacity-60">
              <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            {form.mode === 'existing' && <button type="button" onClick={submit} disabled={busy || !urlOk} title={urlOk ? '' : 'يُقدَّم العنصر برابط الدليل'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50">
              <Send size={15} aria-hidden="true" /> {busy ? 'جارٍ التقديم…' : 'تقديم الدليل للاعتماد'}
            </button>}
          </div>
        )}
      </div>

      {reminder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-deep">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-sand/20 text-warning"><Paperclip size={22} aria-hidden="true" /></span>
            <p className="text-center text-base font-extrabold text-text-main">أرفق ملف المعلومات بالرسالة</p>
            <p className="mt-2 text-center text-[13px] leading-7 text-text-soft">
              بعد تنزيل الرسالة افتحها في برنامج البريد، و<b className="text-text-main">لا بد أن ترفق بها ملفاً يتضمن المعلومات المراد إدراجها في دليل {city ? `«${city}»` : 'المدينة'}</b>
              (المقر، والفندق، والمواصلات، وأرقام التواصل، وما يلزم المشارك معرفته)، ثم أرسلها.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={downloadRequest} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark">
                <Mail size={15} aria-hidden="true" /> فهمت، نزّل الرسالة
              </button>
              <button type="button" onClick={() => setReminder(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-text-soft hover:bg-background">إلغاء</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
