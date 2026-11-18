// يُستدعى مرة عند إقلاع الخادم (Next.js) — يشغّل مؤقّت دورة حياة الدورات
// داخل الخادم، فلا تتوقف حالات الدورات على مُشغِّل خارجي.
// على الاستضافة السحابية (Vercel) يتولاها المُشغِّل المجدول هناك.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.VERCEL || process.env.INTERNAL_LIFECYCLE === 'off') return;
  const { start } = await import('./lib/server/lifecycleTimer');
  start();
}
