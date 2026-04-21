const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const conversations = await messagesService.getConversationList(req.user.id);
      return res.status(200).json(conversations);
    }

    if (req.method === 'POST') {
      const msg = await messagesService.sendMessage(req.user.id, req.body || {});
      return res.status(201).json(msg);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
