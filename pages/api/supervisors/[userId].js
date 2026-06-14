const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { userId } = req.query;

  try {
    return res.status(200).json(await projectsService.unassignSupervisor(userId, req.user.id));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['DELETE'], withManager(handler));
module.exports.default = module.exports;
