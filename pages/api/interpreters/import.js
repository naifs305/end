// POST /api/interpreters/import — استيراد قائمة مترجمين من ملف (المدير)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/interpreters/interpreters.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.interpreters;
    return ok(res, await svc.importMany(items, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
