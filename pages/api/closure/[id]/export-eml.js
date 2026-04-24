const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');
const { buildReportEml, toAsciiFilename } = require('../../../../lib/email/eml');

function buildSubject(courseName, elementKey) {
  const prefix = elementKey === 'opening_report'
    ? 'مسودة بريد - تقرير افتتاح دورة'
    : 'مسودة بريد - تقرير اختتام دورة';
  return `${prefix} - ${courseName || 'دورة تدريبية'}`;
}

function buildDownloadName(courseName, elementKey) {
  const prefix = elementKey === 'opening_report' ? 'opening-report' : 'closing-report';
  const safeCourse = toAsciiFilename(courseName || 'course');
  return `${prefix}-${safeCourse}`;
}

async function handler(req, res) {
  try {
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

    const filenameBase = buildDownloadName(element.course?.name, element.element?.key);
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.eml"`);
    return res.status(200).send(eml);
  } catch (error) {
    console.error('EML export error:', error);
    return res.status(500).json({
      message: 'تعذر إنشاء ملف EML',
      error: process.env.NODE_ENV !== 'production' ? String(error?.message || error) : undefined,
    });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    responseLimit: '20mb',
  },
};
