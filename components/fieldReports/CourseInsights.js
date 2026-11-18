import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, Lightbulb, MessageSquareText, ThumbsUp, MapPin } from 'lucide-react';
import api from '../../lib/axios';

// ======================================================================
// ملاحظات ميدانية من تقارير الدورات — تُقرأ من تقريري الافتتاح والاختتام
// بمصدرها وكاتبها ودورتها، وتتجدّد مع كل تقرير جديد.
// ======================================================================

const KIND_META = {
  issue: { Icon: AlertTriangle, cls: 'bg-danger/10 text-danger border-danger/20' },
  recommendation: { Icon: Lightbulb, cls: 'bg-accent/15 text-accent-dark border-accent/30' },
  note: { Icon: MessageSquareText, cls: 'bg-primary-light text-primary border-primary/20' },
  praise: { Icon: ThumbsUp, cls: 'bg-forest-50 text-primary border-forest-200' },
};
const KIND_ORDER = ['issue', 'recommendation', 'note', 'praise'];
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const num = (n) => Number(n || 0).toLocaleString('ar-SA');

export default function CourseInsights() {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('issue');
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    api.get('/field-reports/insights').then((r) => setData(r.data?.data ?? r.data)).catch(() => setData({ items: [], counts: { byKind: {}, bySection: {} } }));
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    const needle = q.trim();
    return data.items.filter((i) => (!kind || i.kind === kind) && (!section || i.section === section)
      && (!needle || i.text.includes(needle) || i.course?.name?.includes(needle) || i.author?.name?.includes(needle)));
  }, [data, kind, section, q]);

  useEffect(() => { setLimit(40); }, [kind, section, q]);

  if (!data) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  const c = data.counts || { byKind: {}, bySection: {} };

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border bg-white p-4 text-[13px] leading-relaxed text-text-soft shadow-card">
        ما كتبه المنسقون في تقارير الافتتاح والاختتام عن بيئة التدريب والمدربين والمتدربين والمحتوى والمنصة والخدمات المساندة، وتوصياتهم —
        مجموعةً هنا ليتعلّم منها الجميع. ابدأ بما يحتاج معالجة، فهو ما يتكرر في الدورات القادمة إن لم يُتلافَ.
      </p>

      <div className="flex flex-wrap gap-2">
        {KIND_ORDER.map((k) => {
          const { Icon, cls } = KIND_META[k];
          const active = kind === k;
          return (
            <button key={k} type="button" onClick={() => setKind(active ? '' : k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${active ? cls : 'border-border bg-white text-text-soft hover:bg-background'}`}>
              <Icon size={14} aria-hidden="true" /> {data.kinds?.[k]} <span className="opacity-70">{num(c.byKind[k])}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="المحور"
          className="rounded-full border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary">
          <option value="">كل المحاور</option>
          {Object.entries(data.sections || {}).map(([k, label]) => <option key={k} value={k}>{label} ({num(c.bySection[k])})</option>)}
        </select>
        <label className="relative min-w-[220px] flex-1">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: الانتداب، المنصة، القاعة، اسم دورة…" aria-label="بحث في الملاحظات"
            className="w-full rounded-full border border-border bg-white py-2 pe-4 ps-9 text-[13px] outline-none focus:border-primary" />
        </label>
        <span className="text-[12px] text-text-soft">{num(items.length)} ملاحظة</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border bg-white py-12 text-center text-sm text-text-soft">لا ملاحظات بهذا الاختيار.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.slice(0, limit).map((i) => {
            const { Icon, cls } = KIND_META[i.kind] || KIND_META.note;
            return (
              <article key={i.id} className="flex flex-col rounded-[20px] border border-border bg-white p-4 shadow-card">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}><Icon size={12} aria-hidden="true" /> {i.kindLabel}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-text-soft">{i.sectionLabel}</span>
                  {i.ratingLabel && <span className="text-[11px] text-text-soft">· {i.ratingLabel}</span>}
                </div>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-text-main">{i.text}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-[11px] text-text-soft" style={{ marginTop: '0.75rem' }}>
                  <Link href={`/courses/${i.course.id}`} className="font-bold text-primary hover:underline">{i.course.name}</Link>
                  {i.course.city && <span className="inline-flex items-center gap-0.5"><MapPin size={11} aria-hidden="true" /> {i.course.city}</span>}
                  <span>· {i.author?.name || '—'}</span>
                  <span>· {i.source}</span>
                  <span>· {fmtDate(i.at)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {items.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 60)} className="w-full rounded-xl border border-border bg-white py-2.5 text-[13px] font-bold text-primary hover:bg-background">
          عرض المزيد ({num(items.length - limit)})
        </button>
      )}
    </div>
  );
}
