// ======================================================================
// أداء الإدارات — مبنيّ على تقييمات المنسقين بعد إقفال دوراتهم
// ----------------------------------------------------------------------
// لكل إدارة مؤشر من ١٠٠ ينزل بتكرار الصعوبات المنسوبة إليها وأثرها،
// ومعه عدد الصعوبات وبلاغات العوائق ومتوسط أيام التأخير وأكثر صعوباتها.
// للمدير والمشرفين.
// ======================================================================
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { Building2, ClipboardCheck, AlertTriangle, Clock, Gauge, Info } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';

const unwrap = (r) => r?.data?.data ?? r?.data;
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
// لونا السلسلتين — مُتحقَّق منهما لعمى الألوان والتباين
const C_ISSUES = '#00908a';
const C_BLOCKERS = '#B97F1F';
const PERIODS = [
  { key: 'month', label: 'هذا الشهر' }, { key: 'quarter', label: 'هذا الربع' }, { key: 'year', label: 'هذه السنة' }, { key: 'all', label: 'الكل' },
];

// حالة المؤشر نصاً ولوناً معاً (لا يُعتمد على اللون وحده)
function statusOf(index) {
  if (index === null || index === undefined) return { label: 'لا تقييمات', ring: '#d5d9d8', text: 'text-text-soft' };
  if (index >= 85) return { label: 'أداء جيد', ring: '#2E7D5B', text: 'text-[#2E7D5B]' };
  if (index >= 70) return { label: 'يحتاج انتباهاً', ring: '#B97F1F', text: 'text-warning' };
  return { label: 'يحتاج متابعة', ring: '#A04A4A', text: 'text-danger' };
}

function Tile({ Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-bold text-text-soft"><Icon size={14} aria-hidden="true" /> {label}</p>
      <p className="mt-1 text-3xl font-extrabold text-text-main">{value}</p>
      {hint && <p className="text-[11px] text-text-soft">{hint}</p>}
    </div>
  );
}

function DeptCard({ d }) {
  const st = statusOf(d.index);
  const pct = d.index ?? 0;
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${st.ring} ${pct * 3.6}deg, #eef1f0 0)` }}
          role="img" aria-label={`مؤشر ${d.name}: ${d.index ?? 'لا تقييمات'}`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-base font-extrabold text-text-main">{d.index === null ? '—' : toAr(d.index)}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-text-main">{d.name}</p>
          <p className={`text-xs font-bold ${st.text}`}>{st.label}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-1 text-center">
        <div className="rounded-lg bg-background py-1.5"><dt className="text-[10.5px] text-text-soft">صعوبات</dt><dd className="text-sm font-extrabold text-text-main">{toAr(d.issues)}</dd></div>
        <div className="rounded-lg bg-background py-1.5"><dt className="text-[10.5px] text-text-soft">بلاغات</dt><dd className="text-sm font-extrabold text-text-main">{toAr(d.blockers)}</dd></div>
        <div className="rounded-lg bg-background py-1.5"><dt className="text-[10.5px] text-text-soft">تأخير</dt><dd className="text-sm font-extrabold text-text-main">{d.avgDelay === null ? '—' : `${toAr(d.avgDelay)} ي`}</dd></div>
      </dl>
      {d.topIssue && <p className="mt-2 truncate text-[11.5px] text-text-soft">الأكثر: <b className="text-text-main">{d.topIssue.label}</b> ({toAr(d.topIssue.count)})</p>}
    </div>
  );
}

export default function DepartmentsPage() {
  const { activeRole } = useAuth();
  const [period, setPeriod] = useState('year');
  const [data, setData] = useState(null);
  const allowed = ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    api.get('/departments/performance', { params: { period } })
      .then((r) => { if (alive) setData(unwrap(r)); })
      .catch((e) => toast.error(e?.response?.data?.message || 'تعذّر تحميل اللوحة'));
    return () => { alive = false; };
  }, [period, allowed]);

  const barData = useMemo(() => (data?.departments || [])
    .filter((d) => d.issues || d.blockers)
    .map((d) => ({ name: d.short, 'صعوبات التقييم': d.issues, 'بلاغات العوائق': d.blockers })), [data]);

  if (!allowed) {
    return <MainLayout breadcrumb={[{ label: 'أداء الإدارات' }]}><p className="py-20 text-center text-text-soft">هذه اللوحة للمدير والمشرفين.</p></MainLayout>;
  }

  const tot = data?.totals;
  return (
    <MainLayout breadcrumb={[{ label: 'أداء الإدارات' }]}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-text-main"><Building2 size={24} aria-hidden="true" className="text-primary" /> أداء الإدارات</h1>
            <p className="text-sm text-text-soft">من تقييمات المنسقين لصعوبات الإقفال، وبلاغات العوائق المنسوبة لكل إدارة.</p>
          </div>
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm" role="tablist" aria-label="الفترة">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${period === p.key ? 'bg-primary text-white' : 'text-text-soft hover:text-text-main'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {!data ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile Icon={ClipboardCheck} label="دورات قيّمها منسقوها" value={toAr(tot.reviewed)} hint={tot.reviewed ? `${toAr(tot.withIssues)} منها بصعوبات` : 'لا تقييمات في الفترة'} />
              <Tile Icon={AlertTriangle} label="الصعوبات المسجّلة" value={toAr(tot.issues)} hint={`و${toAr(tot.blockers)} بلاغ عائق`} />
              <Tile Icon={Clock} label="متوسط أيام التأخير" value={tot.avgDelay === null ? '—' : toAr(tot.avgDelay)} hint="لما سُجّل له تأخير" />
              <Tile Icon={Gauge} label="متوسط مؤشر الإدارات" value={tot.avgIndex === null ? '—' : toAr(tot.avgIndex)} hint="من ١٠٠" />
            </div>

            {tot.reviewed > 0 && tot.reviewed < 5 && (
              <p className="flex items-start gap-1.5 rounded-xl border border-sand/50 bg-sand/10 px-3 py-2 text-[12px] text-text-main">
                <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
                التقييمات في هذه الفترة قليلة ({toAr(tot.reviewed)})، فالمؤشرات أولية — تستقر كلما زاد عدد الدورات المقيَّمة.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.departments.map((d) => <DeptCard key={d.key} d={d} />)}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-extrabold text-text-main">الصعوبات حسب الإدارة</h2>
                <p className="mb-2 text-[11.5px] text-text-soft">ما سجّله المنسقون بعد الإقفال، وبلاغات العوائق أثناءه.</p>
                {barData.length ? (
                  <div dir="ltr" style={{ height: Math.max(220, barData.length * 44) }}>
                    <ResponsiveContainer>
                      <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap={10}>
                        <CartesianGrid horizontal={false} stroke="#eef1f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#5E6F70' }} axisLine={false} tickLine={false} reversed />
                        <YAxis type="category" dataKey="name" orientation="right" width={110} tick={{ fontSize: 12, fill: '#1C2E30', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,144,138,0.06)' }} contentStyle={{ fontFamily: 'Cairo', direction: 'rtl', borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                        <Bar dataKey="صعوبات التقييم" stackId="a" fill={C_ISSUES} stroke="#fff" strokeWidth={2} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="بلاغات العوائق" stackId="a" fill={C_BLOCKERS} stroke="#fff" strokeWidth={2} radius={[4, 0, 0, 4]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-12 text-center text-sm text-text-soft">لا صعوبات مسجّلة في هذه الفترة.</p>}
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-extrabold text-text-main">الاتجاه في آخر ١٢ شهراً</h2>
                <p className="mb-2 text-[11.5px] text-text-soft">عدد التقييمات وعدد الصعوبات المسجّلة كل شهر.</p>
                <div dir="ltr" style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.trend} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="#eef1f0" />
                      <XAxis dataKey="label" reversed tick={{ fontSize: 11, fill: '#5E6F70', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} orientation="right" width={30} tick={{ fontSize: 11, fill: '#5E6F70' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontFamily: 'Cairo', direction: 'rtl', borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                      <Line type="monotone" dataKey="reviews" name="التقييمات" stroke={C_ISSUES} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="issues" name="الصعوبات" stroke={C_BLOCKERS} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <h2 className="mb-3 text-sm font-extrabold text-text-main">أكثر الصعوبات تكراراً</h2>
                {data.topIssues.length ? (
                  <ul className="space-y-2.5">
                    {data.topIssues.map((x) => {
                      const max = data.topIssues[0].count || 1;
                      return (
                        <li key={`${x.department}-${x.label}`}>
                          <div className="mb-1 flex justify-between gap-2 text-[12.5px]"><span className="truncate text-text-main"><b>{x.label}</b> <span className="text-text-soft">— {x.department}</span></span><b className="text-text-main">{toAr(x.count)}</b></div>
                          <div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full" style={{ width: `${(x.count / max) * 100}%`, background: C_ISSUES }} /></div>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="py-8 text-center text-sm text-text-soft">لا صعوبات بعد.</p>}
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <h2 className="mb-3 text-sm font-extrabold text-text-main">أحدث ملاحظات المنسقين</h2>
                {data.recent.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead><tr className="border-b border-border text-start text-text-soft"><th className="py-2 text-start font-bold">الإدارة</th><th className="py-2 text-start font-bold">الصعوبة</th><th className="py-2 text-start font-bold">الأثر</th><th className="py-2 text-start font-bold">التأخير</th><th className="py-2 text-start font-bold">الدورة</th></tr></thead>
                      <tbody>
                        {data.recent.map((r) => (
                          <tr key={r.id} className="border-b border-border/60 align-top">
                            <td className="py-2 font-bold text-text-main">{r.departmentName}</td>
                            <td className="py-2 text-text-main">{r.issueLabel}{r.note && <span className="block text-[11px] text-text-soft">«{r.note}»</span>}</td>
                            <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.impact === 'HIGH' ? 'bg-danger/10 text-danger' : r.impact === 'MEDIUM' ? 'bg-sand/25 text-warning' : 'bg-primary-light text-primary'}`}>{r.impactLabel}</span></td>
                            <td className="py-2 text-text-main">{r.delayDays === null ? '—' : `${toAr(r.delayDays)} يوم`}</td>
                            <td className="py-2"><Link href={`/courses/${r.courseId}`} className="font-bold text-primary hover:underline">{r.courseName}</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="py-8 text-center text-sm text-text-soft">لا ملاحظات بعد.</p>}
              </section>
            </div>

            <p className="flex items-start gap-1.5 text-[11.5px] text-text-soft">
              <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              المؤشر = ١٠٠ × (١ − الصعوبات المرجّحة بأثرها ÷ عدد الدورات المقيَّمة). الوزن: بسيط ٠٫٥، متوسط ١، كبير ١٫٥، وبلاغ العائق ٠٫٥. فالإدارة التي لم تُسجَّل عليها صعوبة مؤشرها ١٠٠.
            </p>
          </>
        )}
      </div>
    </MainLayout>
  );
}
