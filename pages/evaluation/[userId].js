import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Printer, ArrowRight } from 'lucide-react';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';

// ======================================================================
// ملف التقييم السنوي لموظف — يُطبع ويُرفق بملف تقييمه
// التقييم ومكوّناته، ثم سجل الدرجات شاهداً على كل رقم.
// ======================================================================

const num = (v, d = 1) => (v == null ? '—' : Number(v).toLocaleString('ar-SA', { maximumFractionDigits: d }));
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });

function Part({ label, value, weight, note }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-text-soft">{label}{weight != null && <> · الوزن {num(weight)}</>}</p>
      <p className="text-2xl font-extrabold text-primary tabular-nums">{num(value)}</p>
      {note && <p className="text-[10px] text-text-soft">{note}</p>}
    </div>
  );
}

export default function EvaluationFile() {
  const router = useRouter();
  const { activeRole } = useAuth();
  const { userId, year } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId || !activeRole) return;
    api.get(`/evaluation/${userId}`, { params: { year } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.message || 'تعذّر تحميل الملف'));
  }, [userId, year, activeRole]);

  const byCategory = useMemo(() => {
    if (!data) return [];
    const g = new Map();
    for (const e of data.entries) {
      if (!g.has(e.category)) g.set(e.category, []);
      g.get(e.category).push(e);
    }
    return Array.from(g.entries());
  }, [data]);

  if (error) return <p className="p-10 text-center text-danger">{error}</p>;
  if (!data) return <p className="p-10 text-center text-text-soft">جارٍ إعداد الملف…</p>;

  const { row, settings } = data;
  const ev = row.evaluation || {};
  const p = ev.parts || {};
  const w = settings?.weights || {};

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-text-main print:max-w-none print:p-0" dir="rtl">
      <style>{`@media print { @page { size: A4; margin: 14mm; } .avoid { break-inside: avoid; } }`}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-bold text-primary"><ArrowRight size={16} aria-hidden="true" /> رجوع</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"><Printer size={16} aria-hidden="true" /> طباعة / حفظ PDF</button>
      </div>

      <header className="flex items-end justify-between border-b-2 border-primary pb-3">
        <div>
          <p className="text-[12px] text-text-soft">جامعة نايف العربية للعلوم الأمنية · منصة إتمام</p>
          <h1 className="text-2xl font-extrabold text-primary">ملف التقييم السنوي {data.year}</h1>
        </div>
        <p className="text-[11px] text-text-soft">أُعدّ في {fmtDate(new Date())}{data.archived ? ' · من الرصيد المحفوظ' : ''}</p>
      </header>

      <section className="avoid mt-4 grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl bg-primary-light/60 p-4">
        <div>
          <p className="text-xl font-extrabold">{row.name}</p>
          <p className="text-[12px] text-text-soft">{row.project || '—'} · {row.isSupervisor ? 'منسق ومشرف' : 'منسق'} · {num(row.coursesCount, 0)} دورة · الترتيب {num(row.rank, 0)} من {num(data.of, 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-extrabold text-primary tabular-nums">{num(ev.final)}</p>
          <p className="text-[12px] font-bold">{ev.rating ? `(${ev.rating.grade}) ${ev.rating.name}` : '—'}</p>
          {ev.provisional && <p className="text-[10px] text-warning">مؤقت — بانتظار تقدير المدير</p>}
        </div>
      </section>

      <section className="avoid mt-4">
        <h2 className="mb-2 text-sm font-extrabold text-primary">مكوّنات التقييم</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Part label="الأداء في التنفيذ" value={p.execution} weight={w.execution} note={p.possible ? `حصّل ${num(p.earned)} من ${num(p.possible)} ممكنة` : 'لا عناصر مستحقة'} />
          <Part label="تسجيل الدورات المسندة" value={p.registration} weight={w.registration} note={p.assigned ? `سجّل ${num(p.registered, 0)} من ${num(p.assigned, 0)}` : 'لم يُسجَّل عدد مسند'} />
          <Part label="التميّز والتعاون" value={p.excellence} weight={w.excellence} note={`${num(p.excellencePoints)} درجة`} />
          <Part label="تقدير المدير" value={ev.managerRating} weight={w.manager} />
        </div>
        {ev.supervision && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Part label="مؤشر الإشراف" value={ev.supervision.index} note={`يُضاف ${num(settings.supervisorShare)}٪ منه: +${num(ev.supervisionBonus)}`} />
            <Part label="سرعة البتّ" value={ev.supervision.speed} note={ev.supervision.avgHours != null ? `${num(ev.supervision.decisions, 0)} قراراً بمتوسط ${num(ev.supervision.avgHours)} ساعة` : ''} />
            <Part label="إقفال دورات الفريق في موعدها" value={ev.supervision.closure} />
            <Part label="أداء الفريق" value={ev.supervision.team} />
          </div>
        )}
        <p className="mt-2 text-[11px] text-text-soft">
          مؤشر الأداء نسبة ما حصّله الموظف إلى أقصى ما أتاحته دوراته هو، فلا يتأثر بعدد الدورات المسندة إليه.
          {ev.supervision && ' والمشرف يُقيَّم منسقاً تقييماً كاملاً، ويُضاف إليه جزء من مؤشر إشرافه بسقف ١٠٠.'}
        </p>
      </section>

      <section className="avoid mt-4">
        <h2 className="mb-2 text-sm font-extrabold text-primary">رصيد الإنجاز: {num(row.total)} درجة</h2>
        <table className="w-full text-[12px]">
          <tbody className="divide-y divide-border">
            {Object.entries(data.categories).map(([k, label]) => (
              <tr key={k}><td className="py-1.5">{label}</td><td className="py-1.5 text-end font-bold tabular-nums" dir="ltr">{signed(data.summary.byCategory?.[k] || 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-extrabold text-primary">سجل الدرجات ({num(data.entries.length, 0)} حركة)</h2>
        {byCategory.map(([cat, list]) => (
          <div key={cat} className="mb-3">
            <p className="bg-background px-2 py-1 text-[12px] font-bold">{data.categories[cat] || cat}</p>
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-border">
                {list.map((e, i) => (
                  <tr key={i} className="avoid">
                    <td className="w-20 py-1 align-top text-text-soft">{fmtDate(e.date)}</td>
                    <td className="py-1 align-top"><b>{e.title}</b> — {e.detail}{e.courseName ? ` · ${e.courseName}` : ''}</td>
                    <td className="w-14 py-1 text-end align-top font-bold tabular-nums" dir="ltr">{signed(e.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
