// POST /api/notifications/[id]/read
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const service = require('../../../../lib/services/notifications');

async function handler(req, res) {
  const { id } = req.query;
  try {
    const r = await service.markAsRead(id, req.user.id);
    return res.status(200).json(r);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
