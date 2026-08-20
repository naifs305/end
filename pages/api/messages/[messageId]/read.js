// PUT /api/messages/[messageId]/read
const { withAuth, withMethods, ok, fail } = require('../../../../lib/server/http');
const messagingService = require('../../../../lib/modules/messaging/messaging.service');

async function handler(req, res) {
  const { messageId } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    return ok(res, await messagingService.markMessageAsRead(messageId, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
