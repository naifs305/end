// GET /api/supervisors
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const supervisors = await projectsService.listSupervisors();
  return res.status(200).json(supervisors);
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
