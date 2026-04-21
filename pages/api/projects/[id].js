// GET/PUT/DELETE /api/projects/[id]
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const project = await projectsService.getProject(id);
      return res.status(200).json(project);
    }

    if (req.method === 'PUT') {
      const updated = await projectsService.updateProject(id, req.body?.name, req.user.id);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const result = await projectsService.deleteProject(id, req.user.id);
      return res.status(200).json(result);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
