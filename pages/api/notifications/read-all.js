// POST /api/notifications/read-all
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const service = require('../../../lib/services/notifications');

async function handler(req, res) {
  try {
    await service.markAllAsRead(req.user.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ code: 'serverErrors.common.serverError', message: err.message });
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
