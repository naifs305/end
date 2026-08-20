// PUT / DELETE  /api/options/[id]  — تعديل/حذف خيار واحد (مدير فقط)
const { withMethods, withManager, withValidation, ok, fail } = require('../../../lib/server/http');
const config = require('../../../lib/modules/config/config.service');
const { optionUpdateSchema } = require('../../../lib/modules/config/config.schema');

async function handler(req, res) {
  const { id } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole };

  try {
    if (req.method === 'PUT') {
      return await withValidation(optionUpdateSchema, (r, s) =>
        config.updateOption(id, r.valid, actor).then((updated) => ok(s, updated))
      )(req, res);
    }
    // DELETE
    await config.deleteOption(id, actor);
    return ok(res, { deleted: true });
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
