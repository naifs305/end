// POST /api/courses/[id]/notes-report/print
const prisma = require('../../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../../lib/middleware/auth');
const permissions = require('../../../../../lib/services/permissions');
const { renderNotesReport } = require('../../../../../lib/reports/notesReport');

async function handler(req, res) {
  const { id } = req.query;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      operationalProject: true,
    },
  });

  if (!course) {
    return res.status(404).json({ message: 'الدورة غير موجودة' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بإنشاء هذا التقرير' });
  }

  const data = req.body || {};
  const html = renderNotesReport({ course, data }, { mode: 'print' });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
    responseLimit: '12mb',
  },
};
