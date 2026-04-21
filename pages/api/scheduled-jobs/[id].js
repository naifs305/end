// PUT/DELETE /api/scheduled-jobs/[id]
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const scheduler = require('../../../lib/services/scheduler');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'PUT') {
      const updated = await scheduler.updateJob(id, req.body || {});
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const result = await scheduler.deleteJob(id);
      return res.status(200).json(result);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['PUT', 'DELETE'], withManager(handler));
module.exports.default = module.exports;
