// GET /api/messages/sent
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');

async function handler(req, res) {
  const sent = await messagesService.getSent(req.user.id);
  return res.status(200).json(sent);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
