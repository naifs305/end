// ======================================================================
// مساعد التنفيذ — خبرة الزملاء في متناول كل منسق
// ----------------------------------------------------------------------
// ما واجهه المنسقون في إقفال دوراتهم مرتّباً: حسب الإدارة، وحسب مقر التنفيذ
// (الدولة والمدينة والمقر)، ومع كل صعوبة كيف تجاوزها الزملاء. يُبنى من
// تقييمات صعوبات الإقفال، فيزداد نفعه مع كل دورة تُقفل.
// ======================================================================
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Compass, Search, Building2, MapPin, Lightbulb, ChevronDown, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

const unwrap = (r) => r?.data?.data ?? r?.data;
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Stat({ Icon, value, label }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-white/80"><Icon size={13} aria-hidden="true" /> {label}</p>
      <p className="text-2xl font-extrabold">{toAr(value)}</p>
    </div>
  );
}

function IssueRow({ t }) {
  const [open, setOpen] = useState(false);
  const hasMore = t.examples.length > 0 || t.resolutions.length > 0;
  return (
    <li className="rounded-xl border border-border bg-white">
      <button type="button" onClick={() => hasMore && setOpen((v) => !v)} aria-expanded={open}
        className={`flex w-full items-center gap-3 px-3.5 py-3 text-start ${hasMore ? 'hover:bg-background' : 'cursor-default'}`}>
        <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-primary-light px-2 text-sm font-extrabold text-primary">{toAr(t.count)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text-main">{t.label}</span>
          <span className="flex flex-wrap gap-x-3 text-[11.5px] text-text-soft">
            {t.avgDelay !== null && <span className="inline-flex items-center gap-0.5"><Clock size={11} aria-hidden="true" /> تأخير {toAr(t.avgDelay)} يوم في المتوسط</span>}
            {t.high > 0 && <span className="inline-flex items-center gap-0.5 text-danger"><AlertTriangle size={11} aria-hidden="true" /> أثر كبير {toAr(t.high)}</span>}
            <span>آخرها {fmt(t.lastAt)}</span>
            {t.resolutions.length > 0 && <span className="inline-flex items-center gap-0.5 text-primary"><Lightbulb size={11} aria-hidden="true" /> {toAr(t.resolutions.length)} حل مجرّب</span>}
          </span>
        </span>
        {hasMore && <ChevronDown size={16} aria-hidden="true" className={`text-text-soft transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3.5 py-3">
          {t.resolutions.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-extrabold text-primary"><Lightbulb size={13} aria-hidden="true" /> كيف تجاوزها الزملاء</p>
              <ul className="space-y-1.5">
                {t.resolutions.map((r, k) => (
                  <li key={k} className="rounded-lg bg-primary-light/50 px-3 py-2 text-[13px] text-text-main">
                    {r.resolution}
                    <span className="mt-0.5 block text-[11px] text-text-soft">{[r.place, r.courseName, fmt(r.date)].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.examples.filter((e) => e.note).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-extrabold text-text-main">من ملاحظات الزملاء</p>
              <ul className="space-y-1.5">
                {t.examples.filter((e) => e.note).map((e, k) => (
                  <li key={k} className="rounded-lg bg-background px-3 py-2 text-[13px] text-text-main">
                    «{e.note}»
                    <span className="mt-0.5 block text-[11px] text-text-soft">
                      {[e.place && `📍 ${e.place}`, `أثر ${e.impact}`, e.delayDays !== null && e.delayDays !== undefined ? `تأخير ${toAr(e.delayDays)} يوم` : null, fmt(e.date)].filter(Boolean).join(' · ')}
                      {e.courseId && <> · <Link href={`/courses/${e.courseId}`} className="font-bold text-primary hover:underline">{e.courseName}</Link></>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function AssistantPage() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('departments');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [dep, setDep] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  // البحث بعد توقف الكتابة لحظة
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    let alive = true;
    api.get('/departments/knowledge', { params: { q: query || undefined, department: dep || undefined, country: country || undefined, city: city || undefined } })
      .then((r) => { if (alive) setData(unwrap(r)); })
      .catch((e) => toast.error(e?.response?.data?.message || 'تعذّر تحميل مساعد التنفيذ'));
    return () => { alive = false; };
  }, [query, dep, country, city]);

  const filters = data?.filters;
  const empty = data && data.stats.issues === 0;
  const anyFilter = !!(query || dep || country || city);
  const selectCls = 'rounded-full border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary';
  const locations = useMemo(() => data?.locations || [], [data]);

  return (
    <MainLayout breadcrumb={[{ label: 'مساعد التنفيذ' }]}>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[22px] bg-[#0b3f42] px-6 py-6 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nauss-star.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-14 -start-10 h-56 w-56 opacity-[0.12]" />
          <p className="text-[12px] font-extrabold text-[#e6d9bd]">خبرة الزملاء في متناولك</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><Compass size={26} aria-hidden="true" className="text-[#C6AA76]" /> مساعد التنفيذ</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-white/80">قبل أن تبدأ دورتك: اطّلع على ما واجهه زملاؤك مع كل إدارة وفي كل مقر تنفيذ، وكيف تجاوزوه. تُبنى الصفحة من تقييمات صعوبات الإقفال، فيزيد نفعها مع كل دورة تُقفل.</p>
          {data && (
            <div className="mt-4 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat Icon={AlertTriangle} value={data.stats.issues} label="صعوبة مسجّلة" />
              <Stat Icon={Lightbulb} value={data.stats.withResolution} label="حل مجرّب" />
              <Stat Icon={Building2} value={data.stats.departments} label="إدارة" />
              <Stat Icon={MapPin} value={data.stats.locations} label="مدينة ومقر" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={15} aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 text-text-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: الإنترنت، الأسماء، مدريد، التذاكر…" aria-label="بحث"
              className="w-full rounded-full border border-border bg-white py-2 pe-3 ps-9 text-[13px] outline-none focus:border-primary" />
          </label>
          <select value={dep} onChange={(e) => setDep(e.target.value)} aria-label="الإدارة" className={selectCls}>
            <option value="">كل الإدارات</option>
            {filters?.departments.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
          {filters?.countries.length > 0 && (
            <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="الدولة" className={selectCls}>
              <option value="">كل الدول</option>
              {filters.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {filters?.cities.length > 0 && (
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="المدينة" className={selectCls}>
              <option value="">كل المدن</option>
              {filters.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {anyFilter && <button type="button" onClick={() => { setQ(''); setDep(''); setCountry(''); setCity(''); }} className="rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-white">مسح</button>}
        </div>

        <div className="inline-flex rounded-full bg-white p-1 shadow-sm" role="tablist">
          {[{ k: 'departments', l: 'حسب الإدارة', Icon: Building2 }, { k: 'locations', l: 'حسب مقر التنفيذ', Icon: MapPin }].map(({ k, l, Icon }) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold ${view === k ? 'bg-primary text-white' : 'text-text-soft hover:text-text-main'}`}>
              <Icon size={14} aria-hidden="true" /> {l}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : empty ? (
          <div className="rounded-[20px] border border-dashed border-border bg-white py-16 text-center text-text-soft">
            <Sparkles size={32} aria-hidden="true" className="mx-auto mb-2 opacity-50" />
            <p className="font-bold">{anyFilter ? 'لا نتائج لهذا البحث' : 'لم تُسجَّل صعوبات بعد'}</p>
            <p className="mt-1 text-[12.5px]">تُبنى هذه الصفحة من «تقييم صعوبات الإقفال» الذي يظهر في صفحة كل دورة بعد إقفالها.</p>
          </div>
        ) : view === 'departments' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.departments.map((d) => (
              <section key={d.key} className="rounded-2xl border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 size={17} aria-hidden="true" className="text-primary" />
                  <h2 className="flex-1 text-[15px] font-extrabold text-text-main">{d.name}</h2>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-text-soft">{toAr(d.total)} صعوبة</span>
                </div>
                <ul className="space-y-2">{d.types.map((t) => <IssueRow key={t.key} t={t} />)}</ul>
              </section>
            ))}
          </div>
        ) : locations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white py-12 text-center text-sm text-text-soft">لم تُسجَّل صعوبات في مقرات التنفيذ بعد.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {locations.map((l) => (
              <section key={`${l.country}|${l.city}`} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={17} aria-hidden="true" className="text-warning" />
                  <h2 className="flex-1 text-[15px] font-extrabold text-text-main">{[l.city, l.country].filter(Boolean).join('، ') || 'موقع غير محدد'}</h2>
                  <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-bold text-text-soft">{toAr(l.count)} صعوبة</span>
                </div>
                <ul className="space-y-2.5">
                  {l.venues.map((v) => (
                    <li key={v.venue} className="rounded-xl border border-border px-3.5 py-3">
                      <p className="text-sm font-extrabold text-text-main">{v.venue}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {v.issues.map((x) => <span key={x.label} className="rounded-full bg-sand/20 px-2.5 py-0.5 text-[11.5px] font-bold text-text-main">{x.label} <b className="text-warning">×{toAr(x.count)}</b></span>)}
                      </div>
                      {v.tips.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {v.tips.map((tip, k) => <li key={k} className="flex gap-1.5 text-[12.5px] text-primary"><Lightbulb size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {tip}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
