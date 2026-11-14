// GET /api/documentation/file?k&e&t — صورة متدرب برابط موقّع قصير العمر (لا تُنشر)
const svc = require('../../../lib/modules/documentation/documentation.service');
const store = require('../../../lib/storage/mediaStore');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { key, contentType } = await svc.traineeFileForDisplay(req.query);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = store.readStream(key);
    stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
    return stream.pipe(res);
  } catch (e) {
    return res.status(e.statusCode || 500).end();
  }
}
