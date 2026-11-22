import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { UserCheck, Clock, CheckCircle2, CornerUpLeft, Hourglass, Trophy, MessageSquareQuote, Timer } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

// ======================================================================
// مراجعات الشهادات — لوحة المراجِعين
// ----------------------------------------------------------------------
// من يراجع، وكم يستغرق، وما نتيجة مراجعته (أكّد السلامة أو اكتشف ما يُصحَّح)،
// والمراجعات المنتظرة، وأهم ملاحظات المراجِعين ليتلافاها الجميع.
// ======================================================================

const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('ar-SA', { maximumFractionDigits: d }));
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) : '');
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const PANEL = 'overflow-hidden rounded-2xl border border-border bg-white shadow-card';
// لونان للنتيجتين: أكّد السلامة (الأساسي) — أعاد بملاحظات (الذهبي)
const C_CONFIRM = '#2E6066';
const C_RETURN = '#C6AA76';

function Tile({ Icon, label, value, sub }) {
  return (
    <div className={`${PANEL} p-4`}>
      <p className="flex items-center gap-1.5 text-[12px] text-text-soft"><Icon size={14} aria-hidden="true" /> {label}</p>
      <p className="mt-1 text-2xl font-extrabold text-text-main">{value}</p>
      {sub && <p className="text-[11px] text-text-soft">{sub}</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-text-soft">
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_CONFIRM }} /> أكّد السلامة</span>
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_RETURN }} /> أعاد بملاحظات</span>
    </div>
  );
}

/** المراجعات حسب المراجِع: شريط مكدّس بنتيجتيه */
function ByReviewer({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.reviews));
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-sm font-extrabold text-text-main">المراجعات حسب المراجِع</p>
        <Legend />
      </div>
      <ul className="space-y-2.5 px-5 py-4">
        {rows.map((r) => (
          <li key={r.reviewerId} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[12px]">
            <span className="truncate font-bold text-text-main">{r.name}</span>
            <span className="flex h-4 overflow-hidden rounded" title={`${r.name}: ${r.confirmed} تأكيد، ${r.returned} إعادة`}>
              <span style={{ width: `${(r.confirmed / max) * 100}%`, background: C_CONFIRM }} />
              {r.returned > 0 && <span style={{ width: `${(r.returned / max) * 100}%`, background: C_RETURN, marginInlineStart: 2 }} />}
            </span>
            <span className="tabular-nums text-text-main">{num(r.reviews)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** متوسط وقت المراجعة لكل مراجِع (ساعة) */
function SpeedByReviewer({ rows }) {
  const list = rows.filter((r) => r.avgHours != null).sort((a, b) => a.avgHours - b.avgHours);
  const max = Math.max(1, ...list.map((r) => r.avgHours));
  return (
    <div className={PANEL}>
      <p className="border-b border-border px-5 py-3 text-sm font-extrabold text-text-main">متوسط وقت المراجعة (ساعة) — الأسرع أولاً</p>
      {list.length === 0 ? <p className="px-5 py-6 text-center text-[13px] text-text-soft">لا مراجعات منجزة بعد</p> : (
        <ul className="space-y-2.5 px-5 py-4">
          {list.map((r) => (
            <li key={r.reviewerId} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[12px]">
              <span className="truncate font-bold text-text-main">{r.name}</span>
              <span className="h-4 overflow-hidden rounded bg-background" title={`${r.name}: ${num(r.avgHours, 1)} ساعة`}>
                <span className="block h-full rounded" style={{ width: `${(r.avgHours / max) * 100}%`, background: r.avgHours <= 24 ? C_CONFIRM : C_RETURN }} />
              </span>
              <span className="tabular-nums text-text-main">{num(r.avgHours, 1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** المراجعات شهراً بشهر */
function Monthly({ months }) {
  const max = Math.max(1, ...months.map((m) => m.confirmed + m.returned));
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-sm font-extrabold text-text-main">المراجعات شهراً بشهر</p>
        <Legend />
      </div>
      {months.length === 0 ? <p className="px-5 py-6 text-center text-[13px] text-text-soft">لا مراجعات منجزة بعد</p> : (
        <div className="flex h-44 items-end gap-3 px-5 pb-3 pt-5">
          {months.map((m) => {
            const total = m.confirmed + m.returned;
            const [y, mm] = m.month.split('-');
            return (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end" title={`${MONTHS[Number(mm) - 1]} ${y}: ${m.confirmed} تأكيد، ${m.returned} إعادة`}>
                <span className="mb-1 text-[11px] font-bold text-text-main">{num(total)}</span>
                <div className="flex w-full max-w-[42px] flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(total / max) * 100}%` }}>
                  <span style={{ height: `${(m.confirmed / (total || 1)) * 100}%`, background: C_CONFIRM }} />
                  {m.returned > 0 && <span style={{ height: `${(m.returned / total) * 100}%`, background: C_RETURN, marginBottom: 2 }} />}
                </div>
                <span className="mt-1 text-[10px] text-text-soft">{MONTHS[Number(mm) - 1].slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/cert-reviews/dashboard').then((r) => setData(r.data?.data ?? r.data)).catch(() => setData({ totals: {}, reviewers: [], byMonth: [], notes: [], pending: [] }));
  }, []);
  const top = useMemo(() => (data?.reviewers || [])[0], [data]);

  return (
    <MainLayout breadcrumb={[{ label: 'مراجعات الشهادات' }]}>
      <div className="space-y-4">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-extrabold text-primary"><UserCheck size={22} aria-hidden="true" /> مراجعات الشهادات</h1>
          <p className="text-xs text-text-soft">من يراجع شهادات زملائه، وكم يستغرق، وما يكتشفه قبل تقديمها — ومراجعة الزميل تُكسبه ١٥ درجة في رصيد الإنجاز</p>
        </div>

        {!data ? <div className="h-40 animate-pulse rounded-2xl bg-white shadow-card" /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile Icon={CheckCircle2} label="مراجعات منجزة" value={num(data.totals.reviews)} sub={`${num(data.totals.courses)} دورة`} />
              <Tile Icon={CornerUpLeft} label="أعادها المراجِعون بملاحظات" value={num(data.totals.returned)} sub="أخطاء اكتُشفت قبل التقديم" />
              <Tile Icon={Timer} label="متوسط وقت المراجعة" value={data.totals.avgHours == null ? '—' : `${num(data.totals.avgHours, 1)} ساعة`} sub={data.totals.within24 == null ? '' : `${num(data.totals.within24)}٪ منها خلال يوم`} />
              <Tile Icon={Hourglass} label="بانتظار المراجعة الآن" value={num(data.totals.pending)} sub={data.totals.firstPassShare == null ? '' : `${num(data.totals.firstPassShare)}٪ من الشهادات سليمة من أول إرسال`} />
            </div>

            {data.totals.reviews === 0 && data.totals.pending === 0 ? (
              <p className={`${PANEL} px-5 py-10 text-center text-sm text-text-soft`}>لا مراجعات بعد — تظهر هنا مع أول شهادات يُسند المنسقون مراجعتها لزملائهم.</p>
            ) : (
              <>
                {top && (
                  <div className={`${PANEL} flex items-center gap-3 border-accent/40 p-4`}>
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white"><Trophy size={20} aria-hidden="true" /></span>
                    <div>
                      <p className="text-[12px] text-text-soft">أكثر الزملاء مراجعةً</p>
                      <p className="font-extrabold text-text-main">{top.name} — {num(top.reviews)} مراجعة{top.avgHours != null ? ` بمتوسط ${num(top.avgHours, 1)} ساعة` : ''}</p>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  <ByReviewer rows={data.reviewers.filter((r) => r.reviews > 0)} />
                  <SpeedByReviewer rows={data.reviewers} />
                </div>
                <Monthly months={data.byMonth} />

                <div className={PANEL}>
                  <p className="border-b border-border px-5 py-3 text-sm font-extrabold text-text-main">المراجِعون</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-[13px]">
                      <thead className="bg-background text-[11px] text-text-soft">
                        <tr><th className="px-4 py-2 text-start">المراجِع</th><th className="px-3 py-2">مراجعات</th><th className="px-3 py-2">أكّد السلامة</th><th className="px-3 py-2">أعاد بملاحظات</th><th className="px-3 py-2">بانتظاره</th><th className="px-3 py-2">متوسط الوقت</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border text-center">
                        {data.reviewers.map((r) => (
                          <tr key={r.reviewerId}>
                            <td className="px-4 py-2 text-start font-bold text-text-main">{r.name}</td>
                            <td className="px-3 py-2 tabular-nums">{num(r.reviews)}</td>
                            <td className="px-3 py-2 tabular-nums">{num(r.confirmed)}</td>
                            <td className="px-3 py-2 tabular-nums">{num(r.returned)}</td>
                            <td className={`px-3 py-2 tabular-nums ${r.pending ? 'font-bold text-warning' : ''}`}>{num(r.pending)}</td>
                            <td className="px-3 py-2 tabular-nums">{r.avgHours == null ? '—' : `${num(r.avgHours, 1)} س`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={PANEL}>
                    <p className="flex items-center gap-1.5 border-b border-border px-5 py-3 text-sm font-extrabold text-text-main"><MessageSquareQuote size={16} aria-hidden="true" className="text-accent-dark" /> ملاحظات المراجِعين</p>
                    {data.notes.length === 0 ? <p className="px-5 py-6 text-center text-[13px] text-text-soft">لا ملاحظات بعد</p> : (
                      <ul className="divide-y divide-border">
                        {data.notes.map((n, i) => (
                          <li key={i} className="px-5 py-3">
                            <p className={`text-[11px] font-bold ${n.decision === 'returned' ? 'text-warning' : 'text-primary'}`}>{n.decision === 'returned' ? 'أعادها بملاحظات' : 'أكّد السلامة مع ملاحظة'}</p>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-text-main">{n.note}</p>
                            <p className="mt-1 text-[11px] text-text-soft">
                              {n.reviewerName} على شهادات <Link href={`/courses/${n.courseId}`} className="font-bold text-primary hover:underline">{n.courseName}</Link> ({n.coordinator}) · {fmtDate(n.respondedAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={PANEL}>
                    <p className="flex items-center gap-1.5 border-b border-border px-5 py-3 text-sm font-extrabold text-text-main"><Clock size={16} aria-hidden="true" className="text-warning" /> بانتظار المراجعة</p>
                    {data.pending.length === 0 ? <p className="px-5 py-6 text-center text-[13px] text-text-soft">لا شهادات تنتظر المراجعة</p> : (
                      <ul className="divide-y divide-border">
                        {data.pending.map((p, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 px-5 py-2.5 text-[13px]">
                            <span className="min-w-0">
                              <Link href={`/courses/${p.courseId}`} className="block truncate font-bold text-primary hover:underline">{p.courseName}</Link>
                              <span className="text-[11px] text-text-soft">المراجِع {p.reviewerName} · المنسق {p.coordinator}</span>
                            </span>
                            <span className={`shrink-0 text-[12px] font-bold ${p.waitingHours > 24 ? 'text-danger' : 'text-text-soft'}`}>{num(p.waitingHours, 0)} ساعة</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
