const { withManager, withMethods, created, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const { userId, operationalProjectId } = req.body || {};

  if (!userId || !operationalProjectId) {
    return res.status(400).json({ code: 'serverErrors.supervisors.userAndProjectRequired', message: 'معرف المستخدم والمشروع مطلوبان' });
  }

  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    const assignment = await identity.assignSupervisor({ userId, operationalProjectId }, actor);
    return created(res, assignment);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
