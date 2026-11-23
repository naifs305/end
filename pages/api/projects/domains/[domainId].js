// PUT / DELETE  /api/projects/domains/[domainId] — تعديل مجال أو نقله لمشروع آخر، أو حذفه (مدير فقط)
const { withMethods, withManager, withValidation, ok, fail } = require('../../../../lib/server/http');
const projects = require('../../../../lib/modules/projects/projects.service');
const { updateDomainSchema } = require('../../../../lib/modules/projects/projects.schema');

async function handler(req, res) {
  const { domainId } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'PUT') {
      return await withValidation(updateDomainSchema, (r, s) =>
        projects.updateDomain(domainId, r.valid, actor).then((d) => ok(s, d))
      )(req, res);
    }
    return ok(res, await projects.removeDomain(domainId, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
