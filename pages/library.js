// ======================================================================
// مكتبة الإصدارات — مجلات توثيق الدورات المنشورة، لكل المستخدمين
// ----------------------------------------------------------------------
// كل مجلة منشورة تظهر بغلافها واسم منسقها، فيرى الزملاء أعمال بعضهم.
// والمدير يمنح «إصدار مميّز» لأجودها، فيتصدّر المكتبة بإطار ذهبي
// ويُعلَن في شريط الأخبار — حافزاً للتوثيق المتقن.
// ======================================================================
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Star, Eye, Images, LibraryBig, Award, ExternalLink } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import Avatar from '../components/shared/Avatar';
import PhotoImg from '../components/documentation/PhotoImg';
import api from '../lib/axios';
import { filterDefsMarkup } from '../lib/documentation/photoLook';

const unwrap = (res) => res?.data?.data ?? res?.data;
const FILTER_DEFS = filterDefsMarkup();
const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function CoverCard({ item, canFeature, onFeature }) {
  const square = item.format === 'SQUARE';
  const who = item.coordinator ? `${item.coordinator.firstName} ${item.coordinator.lastName}` : '';
  return (
    <li className={`group relative flex flex-col overflow-hidden rounded-[20px] bg-white transition ${item.featured
      ? 'shadow-[0_0_0_2px_#C6AA76,0_18px_40px_-20px_rgba(178,146,90,0.9)]'
      : 'border border-border shadow-[0_10px_28px_-18px_rgba(28,46,48,0.35)] hover:-translate-y-0.5'}`}>
      <a href={`/m/${item.slug}`} target="_blank" rel="noreferrer" className="relative block overflow-hidden bg-[#0b3f42]" style={{ aspectRatio: square ? '1 / 1' : '210 / 297' }}>
        {item.cover && <PhotoImg m={item.cover} src={item.cover.thumbUrl} alt="" loading="lazy" />}
        <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(11,63,66,.55) 0%,rgba(11,63,66,0) 32%,rgba(7,45,48,.2) 50%,rgba(7,45,48,.94) 84%,#0b3f42 100%)' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nauss-logo-gold.png" alt="" className="absolute start-3 top-3 h-9 w-auto drop-shadow" />
        {item.featured && (
          <span className="absolute end-0 top-4 inline-flex items-center gap-1 rounded-s-full bg-[#C6AA76] py-1 pe-3 ps-2.5 text-[11px] font-extrabold text-[#0b3f42] shadow">
            <Star size={12} fill="currentColor" aria-hidden="true" /> إصدار مميّز
          </span>
        )}
        <span className="absolute inset-x-3 bottom-3 text-white">
          <span className="block text-[15px] font-extrabold leading-snug [text-wrap:balance]">{item.courseName}</span>
          <span className="mt-1 block h-[3px] w-10 rounded bg-[#C6AA76]" />
          <span className="mt-1.5 block text-[11px] text-white/80">{[item.city, fmt(item.startDate)].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="absolute inset-0 grid place-items-center bg-[#0b3f42]/0 opacity-0 transition group-hover:bg-[#0b3f42]/35 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-primary"><ExternalLink size={14} aria-hidden="true" /> تصفّح المجلة</span>
        </span>
      </a>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {item.coordinator && <Avatar user={item.coordinator} size={28} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-text-main">{who}</span>
          <span className="flex items-center gap-2 text-[11px] text-text-soft">
            <span className="inline-flex items-center gap-0.5"><Eye size={12} aria-hidden="true" /> {toAr(item.views || 0)}</span>
            <span className="inline-flex items-center gap-0.5"><Images size={12} aria-hidden="true" /> {toAr(item.photos || 0)}</span>
          </span>
        </span>
        {canFeature && (
          <button type="button" onClick={() => onFeature(item)} aria-pressed={item.featured}
            title={item.featured ? 'إلغاء التمييز' : 'تمييز هذا الإصدار'}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11.5px] font-extrabold ${item.featured ? 'bg-[#C6AA76] text-[#0b3f42]' : 'border border-[#C6AA76]/60 text-warning hover:bg-sand/20'}`}>
            <Award size={13} aria-hidden="true" /> {item.featured ? 'مميّز' : 'ميّزه'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function LibraryPage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/documentation/library')
      .then((r) => { if (alive) setData(unwrap(r)); })
      .catch((e) => toast.error(e.response?.data?.message || 'تعذّر تحميل المكتبة'));
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    const list = data?.items || [];
    const term = q.trim();
    return list.filter((x) => (tab === 'featured' ? x.featured : true) && (!term || `${x.courseName} ${x.coordinator?.firstName || ''} ${x.coordinator?.lastName || ''}`.includes(term)));
  }, [data, tab, q]);
  const featuredCount = (data?.items || []).filter((x) => x.featured).length;

  const feature = async (item) => {
    try {
      await api.post(`/courses/${item.courseId}/documentation/feature`, { featured: !item.featured });
      setData((d) => ({ ...d, items: d.items.map((x) => (x.slug === item.slug ? { ...x, featured: !item.featured } : x)) }));
      toast.success(item.featured ? 'أُلغي التمييز' : '★ صار إصداراً مميّزاً وأُعلن في شريط الأخبار');
    } catch (e) { toast.error(e.response?.data?.message || 'تعذّر تنفيذ الطلب'); }
  };

  return (
    <MainLayout breadcrumb={[{ label: 'مكتبة الإصدارات' }]}>
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: FILTER_DEFS }} />
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[22px] bg-[#0b3f42] px-6 py-7 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nauss-star.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-16 -start-10 h-64 w-64 opacity-[0.13]" />
          <p className="text-[12px] font-extrabold text-[#e6d9bd]">إصدارات وكالة الجامعة للتدريب</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><LibraryBig size={26} aria-hidden="true" className="text-[#C6AA76]" /> مكتبة الإصدارات</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-white/80">مجلات توثيق الدورات التي أعدّها الزملاء ونشروها. والإصدارات المميّزة يختارها المدير لجودة توثيقها وإبداعه.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
            <span><b className="text-xl text-[#C6AA76]">{toAr((data?.items || []).length)}</b> إصداراً</span>
            <span><b className="text-xl text-[#C6AA76]">{toAr(featuredCount)}</b> مميّزاً</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm" role="tablist">
            {[{ k: 'all', l: 'كل الإصدارات' }, { k: 'featured', l: '★ المميّزة' }].map((x) => (
              <button key={x.k} type="button" role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${tab === x.k ? 'bg-primary text-white' : 'text-text-soft hover:text-text-main'}`}>{x.l}</button>
            ))}
          </div>
          <label className="relative ms-auto w-full max-w-xs">
            <Search size={15} aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 text-text-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الدورة أو المنسق" aria-label="بحث"
              className="w-full rounded-full border border-border bg-white py-2 pe-3 ps-9 text-[13px] outline-none focus:border-primary" />
          </label>
        </div>

        {!data ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-white py-16 text-center text-text-soft">
            <LibraryBig size={34} aria-hidden="true" className="mx-auto mb-2 opacity-50" />
            <p className="font-bold">{tab === 'featured' ? 'لا إصدارات مميّزة بعد' : 'لا إصدارات منشورة بعد'}</p>
            <p className="mt-1 text-[12.5px]">وثّق دورتك وانشرها من بطاقة «عنصر التميّز» في صفحة الدورة، فتظهر هنا.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {items.map((item) => <CoverCard key={item.slug} item={item} canFeature={!!data.canFeature} onFeature={feature} />)}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
