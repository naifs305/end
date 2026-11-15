// ======================================================================
// نموذج «مدرب خارجي» — بيانات المدرب، ثم ثلاث رسائل جاهزة
// ----------------------------------------------------------------------
// ١. بيانات المدرب ← رسالة الموارد البشرية لإصدار التذاكر
// ٢. التذاكر المصدرة ← رسالة المراسم (استقبال وتوديع) ورسالة الضيافة (إسكان)
// قبل كل رسالة تُذكّر المنصة بالمرفقات التي يرفقها المنسق بنفسه.
// ======================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Plane, PlaneLanding, PlaneTakeoff, Save, Mail, Send, X, Check, AlertTriangle, Loader2, UserRound, Hotel, Handshake } from 'lucide-react';
import api from '../../lib/axios';

const EMPTY_FLIGHT = { date: '', time: '', flightNo: '', airline: '', city: '' };
const EMPTY = {
  nameAr: '', nameEn: '', title: '', nationality: '', passportNo: '', passportExpiry: '', mobile: '', email: '',
  departureCity: '', travelOut: '', travelBack: '', ticketClass: 'ضيافة', notes: '',
  arrival: { ...EMPTY_FLIGHT }, departure: { ...EMPTY_FLIGHT },
};

const MAILS = {
  hr: {
    label: 'طلب التذاكر — الموارد البشرية', Icon: Plane,
    reminder: {
      title: 'قبل إرسال طلب التذاكر',
      items: ['أرفق موافقة معالي الرئيس.', 'أرفق صورة جواز سفر المدرب.', 'أرفق صورة تأشيرة المدرب.'],
    },
  },
  protocol: {
    label: 'الاستقبال والتوديع — المراسم', Icon: Handshake,
    reminder: { title: 'قبل إرسال طلب الاستقبال والتوديع', items: ['تأكد أن مواعيد الوصول والمغادرة مطابقة للتذكرة المصدرة.', 'يُستحسن إرفاق صورة التذكرة.'] },
  },
  hospitality: {
    label: 'الإسكان والضيافة', Icon: Hotel,
    reminder: {
      title: 'قبل إرسال طلب الإسكان والضيافة',
      items: ['أرفق موافقة معالي الرئيس.', 'أرفق تذكرة المدرب.', 'أرفق صورة جواز سفر المدرب.'],
    },
  },
};

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-background';
function Field({ label, value, onChange, type = 'text', placeholder, disabled, dir }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-text-main">{label}</span>
      <input type={type} value={value || ''} dir={dir} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function FlightFields({ title, Icon, value, onChange, disabled, cityLabel }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-extrabold text-text-main"><Icon size={16} aria-hidden="true" className="text-primary" /> {title}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="التاريخ" type="date" value={value.date} onChange={(v) => set('date', v)} disabled={disabled} />
        <Field label="الوقت" type="time" value={value.time} onChange={(v) => set('time', v)} disabled={disabled} />
        <Field label="رقم الرحلة" value={value.flightNo} onChange={(v) => set('flightNo', v)} placeholder="SV 120" dir="ltr" disabled={disabled} />
        <Field label="شركة الطيران" value={value.airline} onChange={(v) => set('airline', v)} disabled={disabled} />
        <div className="sm:col-span-2"><Field label={cityLabel} value={value.city} onChange={(v) => set('city', v)} disabled={disabled} /></div>
      </div>
    </div>
  );
}

function MailButton({ output, needTicket, ticketReady, enabled, sentAt, fmt, onOpen }) {
  const m = MAILS[output];
  const off = needTicket && !ticketReady;
  return (
    <button type="button" disabled={off || !enabled} title={off ? 'أدخل مواعيد الرحلتين من التذكرة المصدرة أولاً' : ''}
      onClick={() => onOpen({ output, ...m.reminder })}
      className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-white px-3.5 py-2 text-sm font-bold text-primary transition hover:bg-primary-light disabled:opacity-45">
      <m.Icon size={15} aria-hidden="true" /> {m.label}
      {sentAt && <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-light px-1.5 text-[10.5px]"><Check size={11} aria-hidden="true" /> {fmt(sentAt)}</span>}
    </button>
  );
}

export default function ExternalTrainerForm({ trackingId, onClose, onSuccess, readOnly = false }) {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState({});
  const [course, setCourse] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(`/closure/${trackingId}/external-trainer`).then((r) => {
      if (!alive) return;
      const d = r?.data?.data ?? r?.data;
      if (d.trainer) { setForm({ ...EMPTY, ...d.trainer, arrival: { ...EMPTY_FLIGHT, ...d.trainer.arrival }, departure: { ...EMPTY_FLIGHT, ...d.trainer.departure } }); setSavedOnce(true); }
      setSent(d.sent || {});
      setCourse(d.course);
      setCanEdit(!!d.canEdit && !readOnly);
    }).catch((e) => toast.error(e?.response?.data?.message || 'تعذّر تحميل بيانات المدرب')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [trackingId, readOnly]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const disabled = !canEdit;
  const ticketReady = !!(form.arrival.date && form.departure.date);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/closure/${trackingId}/external-trainer`, form);
      setSavedOnce(true); setDirty(false);
      toast.success('حُفظت بيانات المدرب');
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
      return false;
    } finally { setSaving(false); }
  };

  const download = async (output) => {
    if (dirty && !(await save())) return;
    try {
      const res = await api.get(`/closure/${trackingId}/external-trainer`, { params: { output }, responseType: 'blob', headers: { Accept: 'message/rfc822' } });
      const match = (res.headers['content-disposition'] || '').match(/filename="?([^";]+)"?/i);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = match?.[1] || `${output}.eml`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSent((s) => ({ ...s, [output]: new Date().toISOString() }));
      toast.success('نُزِّلت الرسالة — افتحها في برنامج البريد وأرفق ما ذُكّرت به ثم أرسلها');
    } catch (err) {
      const blob = err?.response?.data;
      let msg = 'تعذّر إخراج الرسالة';
      if (blob instanceof Blob) { try { msg = JSON.parse(await blob.text()).message || msg; } catch { /* نص غير مقروء */ } }
      toast.error(msg);
    }
  };

  const submit = async () => {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      await api.put(`/closure/${trackingId}`, { status: 'PENDING_APPROVAL' });
      toast.success('قُدِّم العنصر للاعتماد');
      onSuccess?.(); onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر تقديم العنصر');
    } finally { setBusy(false); }
  };

  const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) : '');

  if (loading) return <div className="rounded-3xl bg-white p-8 text-center text-sm text-text-soft">جارٍ التحميل…</div>;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-deep" dir="rtl">
      <div className="flex items-center gap-3 border-b border-border bg-white px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-light text-primary"><UserRound size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-text-main">مدرب خارجي</p>
          {course && <p className="truncate text-xs text-text-soft">{course.name} · {fmt(course.startDate)} – {fmt(course.endDate)}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full text-text-soft hover:bg-background"><X size={18} /></button>
      </div>

      <div className="space-y-4 p-5">
        {/* ١. بيانات المدرب */}
        <section className="rounded-2xl border border-border bg-white p-4">
          <p className="mb-3 text-sm font-extrabold text-text-main">١. بيانات المدرب</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الاسم بالعربية" value={form.nameAr} onChange={(v) => set('nameAr', v)} disabled={disabled} />
            <Field label="الاسم كما في جواز السفر" value={form.nameEn} onChange={(v) => set('nameEn', v)} dir="ltr" placeholder="JOHN SMITH" disabled={disabled} />
            <Field label="الصفة أو الجهة" value={form.title} onChange={(v) => set('title', v)} placeholder="خبير في …" disabled={disabled} />
            <Field label="الجنسية" value={form.nationality} onChange={(v) => set('nationality', v)} disabled={disabled} />
            <Field label="رقم جواز السفر" value={form.passportNo} onChange={(v) => set('passportNo', v)} dir="ltr" disabled={disabled} />
            <Field label="تاريخ انتهاء الجواز" type="date" value={form.passportExpiry} onChange={(v) => set('passportExpiry', v)} disabled={disabled} />
            <Field label="الجوال" value={form.mobile} onChange={(v) => set('mobile', v)} dir="ltr" disabled={disabled} />
            <Field label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => set('email', v)} dir="ltr" disabled={disabled} />
            <Field label="مدينة السفر منها وإليها" value={form.departureCity} onChange={(v) => set('departureCity', v)} placeholder="لندن" disabled={disabled} />
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-text-main">درجة السفر</span>
              <select value={form.ticketClass} disabled={disabled} onChange={(e) => set('ticketClass', e.target.value)} className={inputCls}>
                {['ضيافة', 'أعمال', 'أولى'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <Field label="التاريخ المقترح للقدوم" type="date" value={form.travelOut} onChange={(v) => set('travelOut', v)} disabled={disabled} />
            <Field label="التاريخ المقترح للعودة" type="date" value={form.travelBack} onChange={(v) => set('travelBack', v)} disabled={disabled} />
            <div className="sm:col-span-2"><Field label="ملاحظات" value={form.notes} onChange={(v) => set('notes', v)} placeholder="اختياري" disabled={disabled} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canEdit && (
              <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                <Save size={15} aria-hidden="true" /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            )}
            <MailButton output="hr" ticketReady={ticketReady} enabled={savedOnce || dirty} sentAt={sent.hr} fmt={fmt} onOpen={setReminder} />
          </div>
        </section>

        {/* ٢. التذاكر المصدرة */}
        <section className="rounded-2xl border border-border bg-white p-4">
          <p className="mb-1 text-sm font-extrabold text-text-main">٢. التذاكر المصدرة</p>
          <p className="mb-3 text-xs text-text-soft">بعد إصدار التذاكر أدخل مواعيد الرحلتين كما في التذكرة، فتُبنى منها رسالتا المراسم والضيافة.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <FlightFields title="الوصول" Icon={PlaneLanding} value={form.arrival} onChange={(v) => set('arrival', v)} disabled={disabled} cityLabel="قادماً من" />
            <FlightFields title="المغادرة" Icon={PlaneTakeoff} value={form.departure} onChange={(v) => set('departure', v)} disabled={disabled} cityLabel="متوجهاً إلى" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canEdit && dirty && (
              <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                <Save size={15} aria-hidden="true" /> حفظ
              </button>
            )}
            <MailButton output="protocol" needTicket ticketReady={ticketReady} enabled={savedOnce || dirty} sentAt={sent.protocol} fmt={fmt} onOpen={setReminder} />
            <MailButton output="hospitality" needTicket ticketReady={ticketReady} enabled={savedOnce || dirty} sentAt={sent.hospitality} fmt={fmt} onOpen={setReminder} />
          </div>
        </section>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3">
            <p className="text-xs text-text-soft">يُقدَّم العنصر للاعتماد بعد إرسال الرسائل الثلاث.</p>
            <button type="button" onClick={submit} disabled={busy || !ticketReady}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-50">
              <Send size={15} aria-hidden="true" /> {busy ? 'جارٍ التقديم…' : 'تقديم للاعتماد'}
            </button>
          </div>
        )}
      </div>

      {reminder && typeof document !== 'undefined' && createPortal(
        <div dir="rtl" className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true" aria-labelledby="trainer-reminder">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand/25 text-warning"><AlertTriangle size={22} aria-hidden="true" /></span>
              <div>
                <h2 id="trainer-reminder" className="text-base font-extrabold text-text-main">{reminder.title}</h2>
                <ul className="mt-2 space-y-1.5 text-sm text-text-main">
                  {reminder.items.map((x) => <li key={x} className="flex gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />{x}</li>)}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button type="button" disabled={busy} onClick={async () => { setBusy(true); await download(reminder.output); setBusy(false); setReminder(null); }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60">
                {busy ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> جارٍ التجهيز…</> : <><Mail size={16} aria-hidden="true" /> فهمت، نزّل الرسالة</>}
              </button>
              <button type="button" disabled={busy} onClick={() => setReminder(null)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background">إلغاء</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
