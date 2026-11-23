// ======================================================================
// إصدار التوثيق من داخل المنصة: المجلة، أو التقرير الفني، أو الاثنان
// ----------------------------------------------------------------------
// التقرير الفني (درجات المتدربين وصورهم) لا يُنشر: يُستخرج من هنا وحده
// لمن يملك الاطلاع على الدورة، ويُحفظ PDF أو يُرسل لإدارة المطابع.
// ======================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MagazineViewer from '../../../../components/documentation/MagazineViewer';
import { buildPages } from '../../../../components/documentation/MagazinePages';
import api from '../../../../lib/axios';
import { useAuth } from '../../../../context/AuthContext';

const TITLES = { magazine: 'المجلة', report: 'التقرير الفني', both: 'المجلة والتقرير الفني' };

export default function DocumentationEdition() {
  const router = useRouter();
  const { id, edition: raw } = router.query;
  const edition = ['magazine', 'report', 'both'].includes(raw) ? raw : 'magazine';
  const [data, setData] = useState(null);
  const [qrSvg, setQrSvg] = useState(null);
  const [error, setError] = useState('');
  // تُفتح في نافذة جديدة: ننتظر حتى تصلها جلسة الدخول قبل الطلب
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (!id || authLoading) return;
    api.get(`/courses/${id}/documentation`)
      .then((res) => setData(res?.data?.data ?? res?.data))
      .catch((e) => setError(e.response?.data?.message || 'تعذّر تحميل التوثيق'));
    api.get(`/courses/${id}/documentation/qr`, { responseType: 'text' })
      .then((res) => setQrSvg(typeof res.data === 'string' ? res.data : null))
      .catch(() => setQrSvg(null));
  }, [id, authLoading]);

  if (error) return <p style={{ padding: 40, fontFamily: 'Cairo', direction: 'rtl' }}>{error}</p>;
  if (!data) return <p style={{ padding: 40, fontFamily: 'Cairo', direction: 'rtl' }}>جارٍ إعداد الإصدار…</p>;
  if (!data.documentation) return <p style={{ padding: 40, fontFamily: 'Cairo', direction: 'rtl' }}>لا توثيق لهذه الدورة بعد.</p>;

  const pages = buildPages({ course: data.course, documentation: data.documentation, edition, qrSvg });
  const shareUrl = data.documentation.slug && typeof window !== 'undefined' ? `${window.location.origin}/m/${data.documentation.slug}` : null;
  return (
    <>
      <Head><title>{`${TITLES[edition]} — ${data.course.name}`}</title></Head>
      <MagazineViewer pages={pages} shareUrl={edition === 'magazine' ? shareUrl : null} title={`${TITLES[edition]} · ${data.course.name}`} allowPress format={data.documentation.format} />
    </>
  );
}
