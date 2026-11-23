// POST /api/projects/domains — إضافة مجال لمشروع (مدير فقط)
const { withMethods, withManager, withValidation, created, fail } = require('../../../../lib/server/http');
const projects = require('../../../../lib/modules/projects/projects.service');
const { createDomainSchema } = require('../../../../lib/modules/projects/projects.schema');

async function handler(req, res) {
  return withValidation(createDomainSchema, async (r, s) => {
    try {
      return created(s, await projects.createDomain(r.valid, { userId: r.user.id, activeRole: r.activeRole }));
    } catch (e) {
      return fail(s, e);
    }
  })(req, res);
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
