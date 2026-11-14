// GET    /api/documentation/media/[mediaId]?s=thumb|full[&e&t] — الصورة نفسها
//        (عامة إن كان التوثيق منشوراً، وإلا برابط موقَّع قصير العمر)
// PATCH  — التعليق، والغلاف، وتعديل المظهر { caption, cover: true, edit, replace }
// DELETE — حذفها
const { withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/documentation/documentation.service');
const store = require('../../../../lib/storage/mediaStore');

async function serve(req, res) {
  try {
    const { key, contentType, published } = await svc.mediaForDisplay(req.query.mediaId, req.query.s, req.query);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', published ? 'public, max-age=86400' : 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = store.readStream(key);
    stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
    return stream.pipe(res);
  } catch (e) {
    return res.status(e.statusCode || 500).end();
  }
}

const edit = withAuth(async (req, res) => {
  const actor = { user: req.user, activeRole: req.activeRole };
  try {
    if (req.method === 'DELETE') return ok(res, await svc.removeMedia(req.query.mediaId, actor));
    return ok(res, await svc.updateMedia(req.query.mediaId, req.body || {}, actor));
  } catch (e) {
    return fail(res, e);
  }
});

async function handler(req, res) {
  if (req.method === 'GET') return serve(req, res);
  if (req.method === 'PATCH' || req.method === 'DELETE') return edit(req, res);
  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).end();
}

module.exports = handler;
module.exports.default = handler;
// التدوير يرسل الصورة كاملة بعد تدويرها
module.exports.config = { api: { bodyParser: { sizeLimit: '8mb' } } };
