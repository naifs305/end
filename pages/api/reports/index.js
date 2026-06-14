const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const reports = require('../../../lib/services/reports');

async function handler(req, res) {
  try {
    if (!['MANAGER', 'PROJECT_SUPERVISOR', 'EMPLOYEE', 'QUALITY_VIEWER'].includes(req.activeRole)) {
      return res.status(403).json({ message: 'غير مصرح لك بالوصول إلى التقارير' });
    }

    const rows = await reports.listReports(req.user, req.activeRole);
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
