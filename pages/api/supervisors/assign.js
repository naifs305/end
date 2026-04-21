// POST /api/supervisors/assign - تعيين مشرف لمشروع
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { userId, operationalProjectId } = req.body || {};

  if (!userId || !operationalProjectId) {
    return res.status(400).json({ message: 'معرّف المستخدم والمشروع مطلوبان' });
  }

  try {
    const assignment = await projectsService.assignSupervisor(
      userId, operationalProjectId, req.user.id,
    );
    return res.status(201).json(assignment);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
