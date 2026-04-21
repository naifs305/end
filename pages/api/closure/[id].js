const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const closureService = require('../../../lib/services/closure');

async function handler(req, res) {
  try {
    return res.status(200).json(await closureService.updateStatus(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
