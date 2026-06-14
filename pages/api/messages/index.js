const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const messagesService = require('../../../lib/services/messages');
const { validateMessage } = require('../../../lib/middleware/validate');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const conversations = await messagesService.getConversationList(req.user.id);
      return res.status(200).json(conversations);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const v = validateMessage({ recipientIds: body.recipientIds, message: body.message, subject: body.subject });
      if (!v.valid) return res.status(400).json({ message: v.message });
      const msg = await messagesService.sendMessage(req.user.id, body);
      return res.status(201).json(msg);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
