// POST /api/courses/[id]/notes-report/eml
const prisma = require('../../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../../lib/middleware/auth');
const permissions = require('../../../../../lib/services/permissions');
const { renderNotesReport } = require('../../../../../lib/reports/notesReport');
const { buildEmlMessage, normalizeAttachments, sanitizeFilename } = require('../../../../../lib/email/eml');

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
  const html = renderNotesReport({ course, data }, { mode: 'email' });

  const eml = buildEmlMessage({
    to: 'OD@NAUSS.EDU.SA',
    cc: 'NALSHAHRANI@NAUSS.EDU.SA',
    subject: `تقرير ملاحظات عامة على الدورة - ${course.name || 'دورة تدريبية'}`,
    htmlBody: html,
    attachments: normalizeAttachments(data.attachments),
  });

  const safeCourseName = sanitizeFilename(course.name || 'course', 'course');
  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="notes-report-${safeCourseName}.eml"`);
  return res.status(200).send(eml);
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
    responseLimit: '25mb',
  },
};
