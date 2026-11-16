// GET /api/courses/[id]/documentation/qr — رمز QR لرابط المجلة العام (SVG)
const QRCode = require('qrcode');
const { withMethods, withAuth, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');
const permissions = require('../../../../../lib/services/permissions');
const { publicOrigin } = require('../../../../../lib/server/origin');

async function handler(req, res) {
  try {
    const slug = await svc.publishedSlug(req.query.id);
    if (!slug) return res.status(404).json({ message: 'لم تُنشر مجلة هذه الدورة بعد' });
    const course = { id: req.query.id, ...(await require('../../../../../lib/modules/documentation/documentation.repo').findCourse(req.query.id)) };
    if (!(await permissions.canViewCourse(req.user, req.activeRole, course))) return res.status(403).end();
    const svg = await QRCode.toString(`${publicOrigin(req)}/m/${slug}`, { type: 'svg', margin: 1, color: { dark: '#0b3f42', light: '#ffffff' } });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="magazine-qr.svg"`);
    return res.status(200).send(svg);
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
