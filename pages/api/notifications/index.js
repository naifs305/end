// GET /api/notifications
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const service = require('../../../lib/services/notifications');

async function handler(req, res) {
  const onlyUnread = req.query.unread === 'true';
  const { page, limit } = req.query;
  const result = await service.getNotifications(req.user.id, onlyUnread, page, limit);
  return res.status(200).json(result);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
