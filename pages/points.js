import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trophy, Medal, TrendingUp, TrendingDown, Sparkles, ListChecks, Info, Archive, Target,
  Flame, ChevronDown, ChevronUp, X, Crown, Users, ArrowUpRight,
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { SupervisorReport, MySupervisorStats, AssignmentSection } from '../components/points/OversightTools';

// ======================================================================
// «رصيد الإنجاز» — درجات بدل النسب، وكل درجة بسببها
// ----------------------------------------------------------------------
// المنسق يرى رصيده وترتيبه وسجله سطراً سطراً، وما يرفع رصيده الآن.
// المشرف يرى فريقه، والمدير الجميع، ويحفظ رصيد كل سنة منقضية.
// ======================================================================

const num = (v, d = 1) => Number(v || 0).toLocaleString('ar-SA', { maximumFractionDigits: d });
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' });
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const LEVEL_CLS = {
  diamond: 'bg-sky-50 text-sky-700 border-sky-200',
  gold: 'bg-accent/15 text-accent-dark border-accent/40',
  silver: 'bg-slate-100 text-slate-600 border-slate-300',
  bronze: 'bg-orange-50 text-orange-700 border-orange-200',
  starter: 'bg-background text-text-soft border-border',
};

const PANEL = 'overflow-hidden rounded-2xl border border-border bg-white shadow-card';

function LevelBadge({ level, size = 'sm' }) {
  if (!level) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold ${LEVEL_CLS[level.key] || LEVEL_CLS.starter} ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>
      <Medal size={size === 'lg' ? 15 : 12} aria-hidden="true" /> {level.name}
    </span>
  );
}

function Points({ v, className = '' }) {
  const tone = v > 0 ? 'text-primary' : v < 0 ? 'text-danger' : 'text-text-soft';
  return <span className={`font-extrabold tabular-nums ${tone} ${className}`} dir="ltr">{signed(v)}</span>;
}

// ── رأس الرصيد ──
function Hero({ data, name }) {
  const { total, rank, of, level, summary } = data;
  const next = level?.next;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-primary-dark text-white shadow-soft">
      <div className="grid gap-5 px-6 py-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm opacity-80">{name ? `رصيد ${name}` : 'رصيدي'} · {data.year}</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums" dir="ltr">{num(total)}</p>
          <p className="mt-1 text-sm opacity-80">درجة إنجاز</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LevelBadge level={level} size="lg" />
            {rank && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><Trophy size={15} aria-hidden="true" /> الترتيب {num(rank)} من {num(of)}</span>}
          </div>
          {next && (
            <div className="mt-4 max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.min(100, (Math.max(0, total) / next.min) * 100))}%` }} />
              </div>
              <p className="mt-1 text-[12px] opacity-85">بقي {num(next.remaining)} درجة لتبلغ مستوى «{next.name}»</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 self-center">
          <div className="col-span-2 rounded-xl bg-white/15 px-4 py-3">
            <p className="text-[12px] opacity-85">مؤشر الأداء (من ١٠٠) — أساس الترتيب والتقييم، ولا يتأثر بعدد دوراتك</p>
            <p className="text-3xl font-extrabold tabular-nums">{data.performance == null ? '—' : num(data.performance)}</p>
            {data.evaluation?.supervision && (
              <p className="text-[11px] opacity-85">منسقاً {num(data.evaluation.coordination)} · ومن الإشراف +{num(data.evaluation.supervisionBonus)} (مؤشر إشرافك {num(data.evaluation.supervision.index)})</p>
            )}
            {data.evaluation?.final != null && !data.evaluation.provisional && (
              <p className="text-[11px] opacity-85">تقييمك السنوي {num(data.evaluation.final)} · {data.evaluation.rating?.name}</p>
            )}
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="inline-flex items-center gap-1 text-[12px] opacity-80"><TrendingUp size={13} aria-hidden="true" /> كسبت</p>
            <p className="text-2xl font-extrabold tabular-nums" dir="ltr">+{num(summary?.gained)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3">
            <p className="inline-flex items-center gap-1 text-[12px] opacity-80"><TrendingDown size={13} aria-hidden="true" /> خسرت</p>
            <p className="text-2xl font-extrabold tabular-nums" dir="ltr">{num(summary?.lost)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── فرص قريبة ──
function Opportunities({ items }) {
  if (!items?.length) return null;
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Sparkles size={18} aria-hidden="true" className="text-accent" />
        <h2 className="text-sm font-extrabold text-text-main">ما يرفع رصيدك الآن</h2>
      </div>
      <ul className="grid gap-2 p-4 md:grid-cols-2">
        {items.map((o, i) => (
          <li key={i} className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${o.kind === 'stop' ? 'border-danger/30 bg-danger/5' : 'border-border bg-background'}`}>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-text-main">{o.title}</p>
              <p className="truncate text-[11px] text-text-soft">{o.courseName}</p>
              <p className={`mt-0.5 text-[11px] ${o.kind === 'stop' ? 'text-danger' : 'text-text-soft'}`}>{o.detail}</p>
            </div>
            {o.courseId && (
              <a href={`/courses/${o.courseId}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary-light">
                <Points v={o.points} /> <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── المجاميع حسب الفئة والشهر ──
function Breakdown({ summary, categories, filter, onFilter }) {
  const cats = Object.entries(categories || {});
  const months = summary?.byMonth || {};
  const maxAbs = Math.max(1, ...Object.values(months).map((v) => Math.abs(v)));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={PANEL}>
        <p className="border-b border-border px-5 py-3 text-sm font-extrabold text-text-main">من أين جاءت درجاتك</p>
        <ul className="divide-y divide-border">
          {cats.map(([key, label]) => {
            const v = summary?.byCategory?.[key] || 0;
            const active = filter === key;
            return (
              <li key={key}>
                <button type="button" onClick={() => onFilter(active ? null : key)}
                  className={`flex w-full items-center justify-between px-5 py-2.5 text-start text-[13px] transition hover:bg-background ${active ? 'bg-primary-light/60' : ''}`}>
                  <span className={active ? 'font-bold text-primary' : 'text-text-main'}>{label}</span>
                  <Points v={v} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={PANEL}>
        <p className="border-b border-border px-5 py-3 text-sm font-extrabold text-text-main">درجاتك شهراً بشهر</p>
        <div className="flex h-48 items-end gap-1.5 px-5 pb-3 pt-6">
          {MONTHS.map((m, i) => {
            const v = months[i + 1] || 0;
            const h = Math.round((Math.abs(v) / maxAbs) * 100);
            return (
              <div key={m} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${m}: ${signed(v)}`}>
                <div className={`w-full rounded-t ${v < 0 ? 'bg-danger/60' : 'bg-primary'}`} style={{ height: `${v ? Math.max(3, h) : 0}%` }} />
                <span className="mt-1 text-[9px] text-text-soft">{m.slice(0, 3)}</span>
                <span className="pointer-events-none absolute -top-5 hidden whitespace-nowrap rounded bg-text-main px-1.5 py-0.5 text-[10px] text-white group-hover:block" dir="ltr">{signed(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── السجل: كل درجة بسببها ──
function Ledger({ entries, categories, filter, onFilter }) {
  const [limit, setLimit] = useState(60);
  const list = useMemo(() => (filter ? entries.filter((e) => e.category === filter) : entries), [entries, filter]);
  const groups = useMemo(() => {
    const g = new Map();
    for (const e of list.slice(0, limit)) {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!g.has(k)) g.set(k, { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [], total: 0 });
      const grp = g.get(k);
      grp.items.push(e);
      grp.total += e.points;
    }
    return Array.from(g.values());
  }, [list, limit]);

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <h2 className="inline-flex items-center gap-2 text-sm font-extrabold text-text-main"><ListChecks size={18} aria-hidden="true" className="text-primary" /> سجل الدرجات</h2>
        {filter && (
          <button type="button" onClick={() => onFilter(null)} className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary">
            {categories?.[filter]} <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      {!groups.length ? (
        <p className="px-5 py-10 text-center text-sm text-text-soft">لا حركات بعد في هذه السنة.</p>
      ) : groups.map((g) => (
        <div key={g.label}>
          <div className="flex items-center justify-between bg-background px-5 py-2 text-[12px] font-bold text-text-soft">
            <span>{g.label}</span><Points v={Math.round(g.total * 10) / 10} />
          </div>
          <ul className="divide-y divide-border">
            {g.items.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                <span className="w-12 shrink-0 pt-0.5 text-[11px] text-text-soft">{fmtDate(e.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-text-main">{e.title}</p>
                  <p className="text-[11px] text-text-soft">
                    {e.detail}
                    {e.courseName && <> · {e.courseId ? <a href={`/courses/${e.courseId}`} className="hover:text-primary hover:underline">{e.courseName}</a> : e.courseName}</>}
                  </p>
                </div>
                <Points v={e.points} className="shrink-0 text-sm" />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {list.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 120)} className="w-full border-t border-border py-2.5 text-[12px] font-bold text-primary hover:bg-background">
          عرض المزيد ({num(list.length - limit, 0)})
        </button>
      )}
    </div>
  );
}

// ── الترتيب ──
function Leaderboard({ board, meId, canOpen, onOpen }) {
  if (!board) return null;
  const top = board.rows.slice(0, 3);
  return (
    <div className="space-y-4">
      {top.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top.map((r, i) => (
            <div key={r.userId} className={`${PANEL} p-4 text-center ${i === 0 ? 'border-accent/50' : ''}`}>
              <div className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${i === 0 ? 'bg-accent text-white' : 'bg-primary-light text-primary'}`}>
                {i === 0 ? <Crown size={20} aria-hidden="true" /> : <span className="font-extrabold">{i + 1}</span>}
              </div>
              <p className="mt-2 font-extrabold text-text-main">{r.name}</p>
              <p className="text-[11px] text-text-soft">{r.project || '—'}</p>
              <p className="mt-1 text-2xl font-extrabold text-primary tabular-nums">{r.performance == null ? '—' : num(r.performance)}</p>
              <p className="text-[11px] text-text-soft">مؤشر الأداء · رصيد {num(r.total, 0)}</p>
              <LevelBadge level={r.level} />
            </div>
          ))}
        </div>
      )}
      <div className={PANEL}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="bg-background text-[11px] text-text-soft">
              <tr>
                <th className="px-4 py-2.5 text-start">#</th>
                <th className="px-4 py-2.5 text-start">المنسق</th>
                <th className="px-4 py-2.5 text-start">المستوى</th>
                <th className="px-4 py-2.5 text-center">دورات منفّذة</th>
                <th className="px-4 py-2.5 text-center">كسب</th>
                <th className="px-4 py-2.5 text-center">خسر</th>
                <th className="px-4 py-2.5 text-center">الرصيد</th>
                <th className="px-4 py-2.5 text-center">مؤشر الأداء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {board.rows.map((r) => {
                const open = canOpen && r.inScope;
                return (
                  <tr key={r.userId} onClick={open ? () => onOpen(r) : undefined}
                    className={`${r.userId === meId ? 'bg-primary-light/50' : ''} ${open ? 'cursor-pointer hover:bg-background' : ''}`}>
                    <td className="px-4 py-2.5 font-extrabold text-primary">{num(r.rank, 0)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-text-main">{r.name}{r.isSupervisor && <span className="ms-1.5 rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-bold text-primary">مشرف</span>}{r.userId === meId && <span className="ms-1 text-[11px] text-primary">(أنت)</span>}</p>
                      <p className="text-[11px] text-text-soft">{r.project || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5"><LevelBadge level={r.level} /></td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{num(r.coursesCount, 0)}</td>
                    <td className="px-4 py-2.5 text-center text-primary tabular-nums" dir="ltr">+{num(r.gained)}</td>
                    <td className="px-4 py-2.5 text-center text-danger tabular-nums" dir="ltr">{num(r.lost)}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-text-main tabular-nums" dir="ltr">{num(r.total)}</td>
                    <td className="px-4 py-2.5 text-center text-base font-extrabold text-primary tabular-nums">{r.performance == null ? '—' : num(r.performance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-text-soft">الترتيب بمؤشر الأداء: ما حصّله المنسق من أقصى ما أتاحته دوراته، فلا يتقدّم أحد بكثرة ما أُسند إليه. والمشرف يُضاف إليه ربع مؤشر إشرافه بسقف ١٠٠. المستويات بالرصيد: {board.levels.map((l) => `${l.name} من ${num(l.min, 0)}`).join(' · ')}</p>
    </div>
  );
}

// ── كيف تُحسب ──
function Rules({ rules, categories }) {
  if (!rules) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rules.map((g) => (
        <div key={g.category} className={PANEL}>
          <p className="border-b border-border bg-background px-5 py-2.5 text-sm font-extrabold text-primary">{categories?.[g.category]}</p>
          <ul className="divide-y divide-border">
            {g.items.map((it) => (
              <li key={it.label} className="flex items-start justify-between gap-3 px-5 py-2.5 text-[13px]">
                <span className="text-text-main">{it.label}</span>
                <span className="shrink-0 font-bold text-text-main" dir="rtl">{it.points}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className={`${PANEL} p-5 text-[13px] leading-relaxed text-text-soft md:col-span-2`}>
        <p className="mb-1 inline-flex items-center gap-1.5 font-extrabold text-text-main"><Info size={15} aria-hidden="true" /> الإنصاف</p>
        <p>مدة بلاغ العائق المقبول لا تُحتسب تأخيراً، والتمديد يُزيح الموعد، والعنصر الموقوف أو المعفى أو غير المنطبق لا له ولا عليه. العنصر يُحتسب لمن قدّمه، وما لم يُقدَّم يُحتسب على منسق الدورة. الرصيد سنوي، ويُحفظ رصيد كل سنة عند انقضائها للرجوع إليه.</p>
      </div>
    </div>
  );
}

// ── سجل منسق آخر (للمشرف والمدير) ──
function MemberDrawer({ member, year, categories, onClose }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(null);
  useEffect(() => {
    setData(null);
    api.get(`/points/ledger/${member.userId}`, { params: { year } })
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(e?.response?.data?.message || 'تعذّر جلب السجل'); onClose(); });
  }, [member.userId, year, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-3xl space-y-4 overflow-y-auto bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-text-main">سجل {member.name}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-full p-2 hover:bg-white"><X size={18} aria-hidden="true" /></button>
        </div>
        {!data ? <div className="h-40 animate-pulse rounded-2xl bg-white" /> : (
          <>
            <Hero data={data} name={member.name} />
            <Breakdown summary={data.summary} categories={categories} filter={filter} onFilter={setFilter} />
            <Ledger entries={data.entries} categories={categories} filter={filter} onFilter={setFilter} />
          </>
        )}
      </div>
    </div>
  );
}

export default function PointsPage() {
  const { user, activeRole } = useAuth();
  const isManager = activeRole === 'MANAGER';
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const [year, setYear] = useState(new Date().getFullYear());
  const [meta, setMeta] = useState(null);
  const [mine, setMine] = useState(null);
  const [board, setBoard] = useState(null);
  const [tab, setTab] = useState(isManager ? 'board' : 'mine');
  const [filter, setFilter] = useState(null);
  const [member, setMember] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const closeMember = useCallback(() => setMember(null), []);

  useEffect(() => { setTab(isManager ? 'board' : 'mine'); }, [isManager]);
  useEffect(() => { api.get('/points/meta').then((r) => setMeta(r.data)).catch(() => {}); }, []);

  const load = useCallback(() => {
    setBoard(null);
    api.get('/points', { params: { year } }).then((r) => setBoard(r.data)).catch(() => setBoard({ rows: [], levels: [] }));
    if (!isManager) {
      setMine(null);
      api.get('/points/ledger/me', { params: { year } }).then((r) => setMine(r.data)).catch(() => setMine(null));
    }
  }, [year, isManager]);
  useEffect(() => { if (activeRole) load(); }, [load, activeRole]);

  const categories = board?.categories || mine?.categories || {};
  const currentYear = new Date().getFullYear();

  const archive = async () => {
    setArchiving(true);
    try {
      const r = await api.post('/points/archive', { year });
      toast.success(`حُفظ رصيد ${year} لـ${r.data?.saved || 0} منسقاً`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setArchiving(false);
    }
  };

  const tabs = [
    ...(!isManager ? [{ key: 'mine', label: 'سجلّي', Icon: ListChecks }] : []),
    { key: 'board', label: 'الترتيب', Icon: Trophy },
    { key: 'rules', label: 'كيف تُحسب', Icon: Info },
    ...(isManager || isSupervisor ? [{ key: 'tools', label: 'أدوات الإشراف', Icon: Users }] : []),
  ];
  const now = new Date();
  const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-xl font-extrabold text-primary"><Flame size={22} aria-hidden="true" /> رصيد الإنجاز</h1>
            <p className="text-xs text-text-soft">درجات تزيد وتنقص بالتزامك وإقفالك ومبادرتك — وكل درجة بسببها أمامك</p>
          </div>
          <div className="flex items-center gap-2">
            {isManager && year < currentYear && !board?.archived && (
              <button type="button" onClick={archive} disabled={archiving} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main hover:bg-background disabled:opacity-50">
                <Archive size={14} aria-hidden="true" /> حفظ رصيد {year}
              </button>
            )}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="السنة"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main outline-none focus:border-primary">
              {(meta?.years || [currentYear]).concat(meta?.years?.includes(currentYear - 1) ? [] : [currentYear - 1]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {board?.archived && (
          <p className="rounded-xl bg-sand/15 px-4 py-2 text-[12px] text-warning">هذا رصيد {year} المحفوظ كما حُسب عند انقضاء السنة.</p>
        )}

        {!isManager && (mine ? <Hero data={mine} /> : <div className="h-44 animate-pulse rounded-2xl bg-white shadow-card" />)}

        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-card">
          <div className="flex min-w-max">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-6 py-3.5 text-sm font-bold transition ${tab === key ? 'border-primary bg-primary-light/30 text-primary' : 'border-transparent text-text-soft hover:bg-background hover:text-primary'}`}>
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'mine' && mine && (
          <>
            <Opportunities items={mine.opportunities} />
            <Breakdown summary={mine.summary} categories={categories} filter={filter} onFilter={setFilter} />
            <Ledger entries={mine.entries} categories={categories} filter={filter} onFilter={setFilter} />
          </>
        )}
        {tab === 'board' && (board ? (
          <Leaderboard board={board} meId={user?.id} canOpen={isManager || isSupervisor} onOpen={setMember} />
        ) : <div className="h-64 animate-pulse rounded-2xl bg-white shadow-card" />)}
        {tab === 'rules' && <Rules rules={meta?.rules} categories={categories} />}
        {tab === 'tools' && (
          <div className="space-y-4">
            {isSupervisor && !isManager && <MySupervisorStats />}
            {isManager && <SupervisorReport periodLabel={periodLabel} />}
            {isManager && <AssignmentSection periodLabel={periodLabel} year={now.getFullYear()} month={now.getMonth() + 1} />}
            <p className="flex items-start gap-1.5 text-[12px] text-text-soft"><Target size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> سجّل عدد الدورات المسندة لكل منسق شهرياً: ما لم يُسجَّل منها في المنصة بعد انقضاء الشهر يُخصم من رصيده.</p>
          </div>
        )}
      </div>
      {member && <MemberDrawer member={member} year={year} categories={categories} onClose={closeMember} />}
    </MainLayout>
  );
}
