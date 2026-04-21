// PUT /api/messages/[messageId]/read
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const messagesService = require('../../../../lib/services/messages');

async function handler(req, res) {
  const { messageId } = req.query;
  try {
    const r = await messagesService.markMessageAsRead(messageId, req.user.id);
    return res.status(200).json(r);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
