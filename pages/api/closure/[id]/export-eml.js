const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');
const { buildReportEml, buildReportMailMeta } = require('../../../../lib/email/eml');

function reportTypeLabel(key) {
  if (key === 'opening_report') return 'تقرير افتتاح الدورة';
  return 'تقرير اختتام الدورة';
}

async function handler(req, res) {
  const { id } = req.query;

  const element = await prisma.courseClosureTracking.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
      element: true,
    },
  });

  if (!element) {
    return res.status(404).json({ message: 'العنصر غير موجود' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بعرض هذا التقرير' });
  }

  const data = element.formData || {};
  const elementKey = element.element.key;
  const html = elementKey === 'opening_report'
    ? renderOpeningReport({ course: element.course, element, data })
    : renderClosingReport({ course: element.course, element, data });

  const mailMeta = buildReportMailMeta({
    courseName: element.course?.name,
    reportType: reportTypeLabel(elementKey),
  });

  const eml = buildReportEml({
    ...mailMeta,
    html,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
  });

  const fileName = `${reportTypeLabel(elementKey)} - ${element.course?.name || 'course'}.eml`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  return res.status(200).send(eml);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '20mb',
  },
};
