const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');

async function handler(req, res) {
  try {
    const conversations = await messagesService.getConversationList(req.user.id);
    return res.status(200).json(conversations);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
