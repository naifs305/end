import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ClipboardCheck, Printer, Info, ShieldCheck, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import MainLayout from '../../components/layout/MainLayout';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';

// ======================================================================
// التقييم السنوي — للمدير
// ----------------------------------------------------------------------
// لكل موظف: مكوّنات مؤشره من إتمام، وخانة واحدة لتقدير المدير، والتقييم
// النهائي ومقابله في السلّم الخماسي، وملف يُطبع ويُرفق بملف تقييمه.
// ======================================================================

const num = (v, d = 1) => (v == null ? '—' : Number(v).toLocaleString('ar-SA', { maximumFractionDigits: d }));
const GRADE_CLS = {
  5: 'bg-primary text-white',
  4: 'bg-primary-light text-primary',
  3: 'bg-accent/15 text-accent-dark',
  2: 'bg-orange-50 text-orange-700',
  1: 'bg-danger/10 text-danger',
};

function Grade({ rating }) {
  if (!rating) return <span className="text-text-soft">—</span>;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${GRADE_CLS[rating.grade]}`}>({rating.grade}) {rating.name}</span>;
}

function RatingCell({ row, year, onSaved }) {
  const initial = row.evaluation?.managerRating;
  const [value, setValue] = useState(initial == null ? '' : String(initial));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(initial == null ? '' : String(initial)); }, [initial]);
  const dirty = value !== (initial == null ? '' : String(initial));
  const save = async () => {
    const v = value.trim();
    if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100)) { toast.error('التقدير رقم من ٠ إلى ١٠٠'); return; }
    setSaving(true);
    try {
      await api.put('/evaluation/rating', { year, userId: row.userId, rating: v === '' ? null : Number(v) });
      toast.success(`حُفظ تقدير ${row.name}`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center justify-center gap-1">
      <input
        type="number" min="0" max="100" inputMode="numeric" value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) save(); }}
        aria-label={`تقدير المدير لـ${row.name}`}
        placeholder="—"
        className="w-16 rounded-lg border border-border px-2 py-1 text-center text-sm font-bold outline-none focus:border-primary"
      />
      {dirty && (
        <button type="button" onClick={save} disabled={saving} aria-label="حفظ" className="rounded-lg bg-primary p-1.5 text-white disabled:opacity-50">
          <Save size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function EvaluationPage() {
  const router = useRouter();
  const { activeRole, loading: authLoading } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!authLoading && activeRole && activeRole !== 'MANAGER') router.replace('/points');
  }, [authLoading, activeRole, router]);

  const load = useCallback(() => {
    api.get('/evaluation', { params: { year } }).then((r) => setData(r.data)).catch((e) => {
      toast.error(e?.response?.data?.message || 'تعذّر تحميل التقييم');
      setData({ rows: [] });
    });
  }, [year]);
  useEffect(() => { if (activeRole === 'MANAGER') { setData(null); load(); } }, [load, activeRole]);

  if (activeRole !== 'MANAGER') return null;
  const w = data?.settings?.weights;
  const rows = data?.rows || [];
  const pending = rows.filter((r) => r.evaluation?.provisional).length;

  return (
    <MainLayout breadcrumb={[{ label: 'التقييم السنوي' }]}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-xl font-extrabold text-primary"><ClipboardCheck size={22} aria-hidden="true" /> التقييم السنوي</h1>
            <p className="text-xs text-text-soft">من مؤشرات إتمام، مع تقديرك في خانة واحدة لكل موظف</p>
          </div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="السنة"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary">
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {w && (
          <div className="flex flex-wrap items-start gap-2 rounded-2xl border border-border bg-white p-4 text-[12px] text-text-soft shadow-card">
            <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
            <p className="leading-relaxed">
              التقييم = التنفيذ <b className="text-text-main">{num(w.execution)}</b> + تسجيل الدورات المسندة <b className="text-text-main">{num(w.registration)}</b> + التميّز <b className="text-text-main">{num(w.excellence)}</b> + تقديرك <b className="text-text-main">{num(w.manager)}</b>
              {' · '}والمشرف يُضاف إليه <b className="text-text-main">{num(data.settings.supervisorShare)}٪</b> من مؤشر إشرافه بسقف ١٠٠.
              {' '}<Link href="/settings" className="font-bold text-primary hover:underline">تعديل الأوزان</Link>
              {pending > 0 && <span className="ms-1 font-bold text-warning">· بانتظار تقديرك لـ{num(pending, 0)} موظفاً (التقييم مؤقت حتى تُدخله)</span>}
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead className="bg-background text-[11px] text-text-soft">
                <tr>
                  <th className="px-3 py-2.5 text-start">الموظف</th>
                  <th className="px-2 py-2.5 text-center">التنفيذ</th>
                  <th className="px-2 py-2.5 text-center">التسجيل</th>
                  <th className="px-2 py-2.5 text-center">التميّز</th>
                  <th className="px-2 py-2.5 text-center">مؤشر الإشراف</th>
                  <th className="px-2 py-2.5 text-center">تقديرك (من ١٠٠)</th>
                  <th className="px-2 py-2.5 text-center">التقييم</th>
                  <th className="px-2 py-2.5 text-center">السلّم</th>
                  <th className="px-2 py-2.5 text-center">الملف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!data ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-text-soft">جارٍ الحساب…</td></tr>
                ) : rows.map((r) => {
                  const ev = r.evaluation || {};
                  const p = ev.parts || {};
                  return (
                    <tr key={r.userId}>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-text-main">{r.name}
                          {r.isSupervisor && <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-bold text-primary"><ShieldCheck size={10} aria-hidden="true" /> مشرف</span>}
                        </p>
                        <p className="text-[11px] text-text-soft">{r.project || '—'} · {num(r.coursesCount, 0)} دورة · رصيد {num(r.total, 0)}</p>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{num(p.execution)}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums" title={p.assigned ? `سجّل ${p.registered} من ${p.assigned}` : 'لم يُسجَّل عدد مسند'}>{num(p.registration)}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">{num(p.excellence)}</td>
                      <td className="px-2 py-2.5 text-center tabular-nums">
                        {ev.supervision ? <>{num(ev.supervision.index)}<span className="block text-[10px] text-primary" dir="ltr">+{num(ev.supervisionBonus)}</span></> : '—'}
                      </td>
                      <td className="px-2 py-2.5"><RatingCell row={r} year={year} onSaved={load} /></td>
                      <td className="px-2 py-2.5 text-center">
                        <span className="text-base font-extrabold text-text-main tabular-nums">{num(ev.final)}</span>
                        {ev.provisional && <span className="block text-[10px] text-warning">مؤقت</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center"><Grade rating={ev.rating} /></td>
                      <td className="px-2 py-2.5 text-center">
                        <Link href={`/evaluation/${r.userId}?year=${year}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary-light">
                          <Printer size={12} aria-hidden="true" /> الملف
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {data?.scale && (
          <p className="text-[11px] text-text-soft">السلّم: {data.scale.map((s) => `(${s.grade}) ${s.name}${s.min ? ` من ${s.min}` : ''}`).join(' · ')}</p>
        )}
      </div>
    </MainLayout>
  );
}
