// GET /api/notifications
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const service = require('../../../lib/services/notifications');

async function handler(req, res) {
  const onlyUnread = req.query.unread === 'true';
  const notifs = await service.getNotifications(req.user.id, onlyUnread);
  return res.status(200).json(notifs);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
