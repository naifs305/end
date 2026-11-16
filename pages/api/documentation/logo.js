// GET /api/documentation/logo?k — شعار شريك (عام: يظهر في المجلة المنشورة، ومفتاحه عشوائي)
const svc = require('../../../lib/modules/documentation/documentation.service');
const store = require('../../../lib/storage/mediaStore');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { key, contentType } = svc.logoForDisplay(req.query.k);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = store.readStream(key);
    stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
    return stream.pipe(res);
  } catch (e) {
    return res.status(e.statusCode || 500).end();
  }
}
