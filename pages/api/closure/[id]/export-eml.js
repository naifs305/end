const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');
const { buildReportEml } = require('../../../../lib/email/eml');

function buildSubject(courseName, elementKey) {
  const prefix = elementKey === 'opening_report' ? 'مسودة بريد - تقرير افتتاح دورة' : 'مسودة بريد - تقرير اختتام دورة';
  return `${prefix} - ${courseName || 'دورة تدريبية'}`;
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

  if (!['opening_report', 'closing_report', 'report'].includes(element.element?.key)) {
    return res.status(400).json({ message: 'ملف EML متاح فقط لتقارير الافتتاح والاختتام' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بعرض هذا التقرير' });
  }

  const data = element.formData || {};
  const html = element.element.key === 'opening_report'
    ? renderOpeningReport({ course: element.course, element, data })
    : renderClosingReport({ course: element.course, element, data });

  const eml = buildReportEml({
    subject: buildSubject(element.course?.name, element.element?.key),
    html,
    to: 'OD@NAUSS.EDU.SA',
    cc: 'NALSHAHRANI@NAUSS.EDU.SA',
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
  });

  const filenameBase = buildSubject(element.course?.name, element.element?.key).replace(/[\\/:*?"<>|]+/g, '_');
  res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.eml"`);
  return res.status(200).send(eml);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { responseLimit: '12mb' } };
