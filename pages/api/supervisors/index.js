const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  return res.status(200).json(await projectsService.listSupervisors());
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
