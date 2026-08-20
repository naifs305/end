const { withMethods, withManager, withValidation, ok, created, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/closure/closure.service');
const { createElementSchema } = require('../../../lib/modules/closure/closure.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return ok(res, await svc.listElements());
    }

    // POST: إنشاء عنصر إقفال جديد (مدير فقط)
    return await withValidation(createElementSchema, (r, s) =>
      svc.createElement(r.valid, r.user, r.activeRole).then((x) => created(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'POST'], withManager(handler));
module.exports.default = module.exports;
