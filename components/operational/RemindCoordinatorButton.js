import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

// زر «ذكّر المنسق» في صفحة الدورة — للمشرف والمدير، ويظهر حين يوجد ما يُذكَّر به
export default function RemindCoordinatorButton({ courseId }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/courses/${courseId}/remind-coordinator`).then((r) => setInfo(r.data?.data ?? r.data)).catch(() => setInfo(null));
  useEffect(() => { if (courseId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseId]);

  if (!info?.allowed || !info.items?.length) return null;
  const cooling = info.cooldownUntil && new Date(info.cooldownUntil) > new Date();

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/courses/${courseId}/remind-coordinator`, { note: note.trim() || undefined });
      toast.success(`ذُكّر ${info.coordinator || 'المنسق'} بـ${info.items.length} عنصر معلّق`);
      setOpen(false);
      setNote('');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر إرسال التذكير');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={cooling}
        title={cooling ? `ذُكّر المنسق اليوم — التذكير التالي بعد ${new Date(info.cooldownUntil).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' })}` : undefined}
        className="inline-flex items-center gap-1.5 rounded-xl border border-sand/60 bg-sand/10 px-3 py-2 text-xs font-extrabold text-warning transition hover:bg-sand/25 disabled:cursor-not-allowed disabled:opacity-60">
        <BellRing size={14} aria-hidden="true" /> {cooling ? 'ذُكّر اليوم' : `ذكّر المنسق (${info.items.length})`}
      </button>
      {open && !cooling && (
        <div className="absolute end-0 top-full z-30 mt-2 w-80 rounded-2xl border border-border bg-white p-4 text-start shadow-soft">
          <p className="text-[13px] font-extrabold text-text-main">تذكير {info.coordinator} بالعناصر المعلّقة</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[12px] text-text-main">
            {info.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-2">
                <span>• {i.name}</span>
                <span className={i.lateDays ? 'text-danger' : 'text-text-soft'}>{i.status !== 'NOT_STARTED' ? 'مُعاد' : i.lateDays ? `متأخر ${i.lateDays} يوماً` : 'حلّ موعده'}</span>
              </li>
            ))}
          </ul>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="ملاحظة (اختيارية)"
            className="mt-2 w-full resize-none rounded-lg border border-border px-2 py-1.5 text-[12px] outline-none focus:border-primary" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="flex-1 rounded-lg bg-primary py-1.5 text-[12px] font-bold text-white disabled:opacity-50">{busy ? 'جارٍ الإرسال…' : 'أرسل التذكير'}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-soft">إلغاء</button>
          </div>
          <p className="mt-2 text-[10px] text-text-soft">يصله في المراسلات وإشعاراً وبريداً.</p>
        </div>
      )}
    </div>
  );
}
