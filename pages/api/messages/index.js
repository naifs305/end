const { withAuth, withMethods, withValidation, ok, created, fail } = require('../../../lib/server/http');
const messagingService = require('../../../lib/modules/messaging/messaging.service');
const { sendMessageSchema } = require('../../../lib/modules/messaging/messaging.schema');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'GET') {
      return ok(res, await messagingService.getConversationList(actor));
    }

    return await withValidation(sendMessageSchema, (r, s) =>
      messagingService.sendMessage(r.valid, actor).then((msg) => created(s, msg)).catch((e) => fail(s, e)),
    )(req, res);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
