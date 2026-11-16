// تنبيه لوحة التحكم: شهادات أسندها زملاء إليك لمراجعتها
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCheck, ChevronLeft } from 'lucide-react';
import api from '../../lib/axios';

export default function CertReviewsDue() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    api.get('/cert-reviews/mine').then((r) => { if (alive) setItems(r?.data?.data ?? r?.data ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-sand/50 bg-sand/10 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-text-main">
        <UserCheck size={17} aria-hidden="true" className="text-warning" /> شهادات تنتظر مراجعتك ({items.length})
      </p>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.trackingId}>
            <Link href={`/courses/${i.courseId}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-text-main hover:text-primary">
              <span className="flex-1 truncate">{i.courseName}</span>
              <span className="text-[11px] font-normal text-text-soft">راجعها وأكّد أو أعدها بملاحظاتك</span>
              <ChevronLeft size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
