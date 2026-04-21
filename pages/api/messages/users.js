// GET /api/messages/users
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');

async function handler(req, res) {
  const users = await messagesService.getUsersForMessaging(req.user.id);
  return res.status(200).json(users);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
