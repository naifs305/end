// بطاقة مجلة في مكتبة الإصدارات ومركز التحفيز: غلافها، ومنسقها، والمشاهدات،
// وإطار ذهبي لـ«الإصدار المميّز»، وزر التمييز للمدير.
import { Star, Eye, Images, Award, ExternalLink } from 'lucide-react';
import Avatar from '../shared/Avatar';
import PhotoImg from './PhotoImg';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function CoverCard({ item, canFeature, onFeature }) {
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
