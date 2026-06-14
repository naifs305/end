// GET /api/messages/inbox
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');

async function handler(req, res) {
  const inbox = await messagesService.getInbox(req.user.id);
  return res.status(200).json(inbox);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
