// GET /api/field-reports/[id]/export
// تصدير تقرير الملاحظات الميداني المؤرشف كصفحة HTML قابلة للطباعة
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderNotesReport } = require('../../../../lib/reports/notesReport');

async function handler(req, res) {
  const { id } = req.query;

  const report = await prisma.fieldReport.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
    },
  });

  if (!report) {
    return res.status(404).json({ message: 'التقرير غير موجود' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, report.course);
  if (!canView && report.authorId !== req.user.id) {
    return res.status(403).json({ message: 'غير مصرح لك بعرض هذا التقرير' });
  }

  const html = renderNotesReport({ course: report.course, data: report.formData || {} }, { mode: 'print' });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '12mb',
  },
};
