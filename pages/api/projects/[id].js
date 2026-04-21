const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await projectsService.getProject(id));
    }

    if (req.method === 'PUT') {
      return res.status(200).json(await projectsService.updateProject(id, req.body?.name, req.user.id));
    }

    return res.status(200).json(await projectsService.deleteProject(id, req.user.id));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
