// GET /api/messages/users
const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const messagingService = require('../../../lib/modules/messaging/messaging.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    return ok(res, await messagingService.getUsersForMessaging(actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
