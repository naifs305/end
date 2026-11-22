import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, ChevronDown, ChevronUp, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

// ======================================================================
// عناصر معلّقة لدى فريقك — المشرف (أو المدير) يذكّر منسقاً أو الفريق كله
// بما حلّ موعده ولم يُقدَّم. رسالة واحدة لكل منسق تجمع دوراته، ومرة في
// اليوم للدورة الواحدة.
// ======================================================================

const num = (n) => Number(n || 0).toLocaleString('ar-SA');

export default function TeamReminders() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api.get('/reminders/team').then((r) => setRows(r.data?.data ?? r.data ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remind = async (userId) => {
    setBusy(userId || 'all');
    try {
      const r = await api.post('/reminders/team', { userId: userId || undefined, note: note.trim() || undefined });
      const d = r.data?.data ?? r.data;
      toast.success(userId ? 'أُرسل التذكير' : `أُرسل التذكير لـ${num(d?.sent)} منسقاً${d?.skipped ? ` (وتُرك ${num(d.skipped)} ذُكّروا اليوم)` : ''}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر إرسال التذكير');
    } finally {
      setBusy(null);
    }
  };

  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.items, 0);
  const late = rows.reduce((s, r) => s + r.late, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-sand/50 bg-white shadow-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-start hover:bg-background">
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand/20 text-warning"><BellRing size={18} aria-hidden="true" /></span>
          <span>
            <span className="block text-sm font-extrabold text-text-main">عناصر معلّقة لدى فريقك</span>
            <span className="block text-[12px] text-text-soft">{num(total)} عنصر لدى {num(rows.length)} منسق{late ? ` · ${num(late)} متأخر عن موعده الأقصى` : ''} — ذكّرهم بضغطة</span>
          </span>
        </span>
        {open ? <ChevronUp size={16} aria-hidden="true" className="text-text-soft" /> : <ChevronDown size={16} aria-hidden="true" className="text-text-soft" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {rows.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-text-main">{r.name}</p>
                  <p className="text-[11px] text-text-soft">
                    {r.courses.map((c, i) => (
                      <span key={c.id}>{i ? '، ' : ''}<Link href={`/courses/${c.id}`} className="hover:text-primary hover:underline">{c.name}</Link> ({num(c.items)})</span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.late > 0 && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">{num(r.late)} متأخر</span>}
                  <button type="button" onClick={() => remind(r.userId)} disabled={!!busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-[12px] font-bold text-primary hover:bg-primary-light disabled:opacity-50">
                    <Send size={12} aria-hidden="true" /> {busy === r.userId ? 'جارٍ الإرسال…' : `ذكّره (${num(r.items)})`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
            placeholder="ملاحظة تُضاف للتذكير (اختيارية) — مثلاً: نحتاج إقفال دورات الشهر قبل الخميس"
            className="w-full resize-none rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-primary" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-text-soft">يصل كل منسق رسالة واحدة تجمع دوراته في المراسلات وإشعار وبريد. والدورة الواحدة تُذكَّر مرة في اليوم.</p>
            <button type="button" onClick={() => remind(null)} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50">
              <BellRing size={15} aria-hidden="true" /> {busy === 'all' ? 'جارٍ الإرسال…' : 'ذكّر الفريق كله'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
