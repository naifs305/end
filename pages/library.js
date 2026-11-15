// ======================================================================
// مكتبة الإصدارات — مجلات توثيق الدورات المنشورة، لكل المستخدمين
// ----------------------------------------------------------------------
// كل مجلة منشورة تظهر بغلافها واسم منسقها، فيرى الزملاء أعمال بعضهم.
// والمدير يمنح «إصدار مميّز» لأجودها، فيتصدّر المكتبة بإطار ذهبي
// ويُعلَن في شريط الأخبار — حافزاً للتوثيق المتقن.
// ======================================================================
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Search, LibraryBig } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import CoverCard from '../components/documentation/CoverCard';
import api from '../lib/axios';
import { filterDefsMarkup } from '../lib/documentation/photoLook';

const unwrap = (res) => res?.data?.data ?? res?.data;
const FILTER_DEFS = filterDefsMarkup();
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

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
