// GET /api/kpis/project/[projectId]?periodType=MONTHLY&periodLabel=2026-01
const { withManagerOrSupervisor, withMethods } = require('../../../../lib/middleware/auth');
const kpis = require('../../../../lib/services/kpis');

async function handler(req, res) {
  const { projectId } = req.query;
  const { periodType, periodLabel } = req.query;

  if (!periodType || !periodLabel) {
    return res.status(400).json({ message: 'periodType و periodLabel مطلوبان' });
  }

  // المشرف يستطيع فقط رؤية مشاريعه
  if (req.activeRole === 'PROJECT_SUPERVISOR') {
    const ids = req.scope?.supervisedProjectIds || [];
    if (!ids.includes(projectId)) {
      return res.status(403).json({ message: 'غير مصرح لك بعرض بيانات هذا المشروع' });
    }
  }

  try {
    const data = await kpis.getProjectKpiSummary(projectId, periodType, periodLabel);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
