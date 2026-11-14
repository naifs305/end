// ======================================================================
// المجلة العامة — لمن يملك الرابط، بلا دخول
// ----------------------------------------------------------------------
// تُعرض المجلة وحدها (لا التقرير الفني ولا درجات المتدربين)، ولا
// تُفهرس في محركات البحث. وعدّاد المشاهدات يُحتسب مرة لكل متصفح في اليوم.
// ======================================================================
import Head from 'next/head';
import QRCode from 'qrcode';
import MagazineViewer from '../../components/documentation/MagazineViewer';
import { buildPages } from '../../components/documentation/MagazinePages';

export async function getServerSideProps({ params, req, res }) {
  const svc = require('../../lib/modules/documentation/documentation.service');
  const { publicOrigin } = require('../../lib/server/origin');
  const slug = String(params.slug || '').toLowerCase();
  const seenCookie = `mz_${slug.slice(0, 12)}`;
  const seen = String(req.headers.cookie || '').includes(`${seenCookie}=1`);
  const data = await svc.getPublic(slug, { countView: !seen });
  if (!data) return { notFound: true };
  if (!seen) res.setHeader('Set-Cookie', `${seenCookie}=1; Path=/m; Max-Age=86400; SameSite=Lax`);
  const url = `${publicOrigin(req)}/m/${slug}`;
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#0b3f42', light: '#ffffff' } });
  return { props: JSON.parse(JSON.stringify({ data, url, qrSvg })) };
}

export default function PublicMagazine({ data, url, qrSvg }) {
  const pages = buildPages({ course: data.course, documentation: data.documentation, edition: 'magazine', qrSvg });
  const cover = data.documentation.media.find((m) => m.id === data.documentation.coverMediaId) || data.documentation.media[0];
  const title = `مجلة توثيق دورة «${data.course.name}» — جامعة نايف العربية للعلوم الأمنية`;
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content="إصدار توثيقي من وكالة الجامعة للتدريب" />
        {cover && <meta property="og:image" content={new URL(cover.fullUrl, url).toString()} />}
      </Head>
      <MagazineViewer pages={pages} shareUrl={url} title={data.course.name} />
    </>
  );
}
