// DELETE /api/supervisors/[userId] - إزالة إشراف
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { userId } = req.query;
  try {
    const result = await projectsService.unassignSupervisor(userId, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['DELETE'], withManager(handler));
module.exports.default = module.exports;
