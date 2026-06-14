const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { userId, operationalProjectId } = req.body || {};

  if (!userId || !operationalProjectId) {
    return res.status(400).json({ message: 'معرف المستخدم والمشروع مطلوبان' });
  }

  try {
    const assignment = await projectsService.assignSupervisor(userId, operationalProjectId, req.user.id);
    return res.status(201).json(assignment);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
