// GET/POST /api/scheduled-jobs
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const scheduler = require('../../../lib/services/scheduler');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const jobs = await scheduler.listJobs();
      return res.status(200).json(jobs);
    }

    if (req.method === 'POST') {
      const job = await scheduler.createJob(req.body || {});
      return res.status(201).json(job);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withManager(handler));
module.exports.default = module.exports;
