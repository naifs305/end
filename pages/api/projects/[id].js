// GET / PUT / DELETE  /api/projects/[id]  — تفاصيل/تعديل/حذف مشروع (مدير فقط)
const { withMethods, withManager, withValidation, ok, fail } = require('../../../lib/server/http');
const projects = require('../../../lib/modules/projects/projects.service');
const { updateProjectSchema } = require('../../../lib/modules/projects/projects.schema');

async function handler(req, res) {
  const { id } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole };

  try {
    if (req.method === 'GET') {
      return ok(res, await projects.getById(id));
    }
    if (req.method === 'PUT') {
      return await withValidation(updateProjectSchema, (r, s) =>
        projects.update(id, r.valid, actor).then((p) => ok(s, p))
      )(req, res);
    }
    // DELETE
    return ok(res, await projects.remove(id, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
