const prisma = require('../../../lib/db/prisma');
const { withMethods, withManager } = require('../../../lib/middleware/auth');
const { logAudit } = require('../../../lib/services/audit');

// الحقول البوليانية في Course التي يمكن استخدامها كشرط لعنصر CONDITIONAL
const ALLOWED_CONDITION_FIELDS = [
  'requiresAdvance',
  'requiresRevenue',
  'materialsIssued',
  'requiresAdvanceSettlement',
  'requiresSupervisorCompensation',
  'requiresTrainerCompensation',
  'requiresPreTest',
  'requiresPostTest',
  'requiresOpeningReport',
  'requiresClosingReport',
];

const ALLOWED_TYPES = ['MANDATORY', 'CONDITIONAL', 'OPTIONAL'];

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const elements = await prisma.closureElement.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return res.status(200).json(elements);
    }

    // POST: إنشاء عنصر إقفال جديد (مدير فقط)
    const { name, elementType, conditionField, isFormBased, deadlineRefPoint, deadlineIdealHours, deadlineMaxHours, isDeadlineWorkingDays } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'اسم العنصر مطلوب' });
    }

    const type = ALLOWED_TYPES.includes(elementType) ? elementType : 'MANDATORY';

    if (type === 'CONDITIONAL' && !ALLOWED_CONDITION_FIELDS.includes(conditionField)) {
      return res.status(400).json({ message: 'حقل الشرط غير صالح لعنصر مشروط' });
    }

    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const created = await prisma.closureElement.create({
      data: {
        key,
        name: String(name).trim(),
        isFormBased: !!isFormBased,
        deadlineRefPoint: deadlineRefPoint || null,
        deadlineIdealHours: deadlineIdealHours ?? null,
        deadlineMaxHours: deadlineMaxHours ?? null,
        isDeadlineWorkingDays: !!isDeadlineWorkingDays,
        elementType: type,
        conditionField: type === 'CONDITIONAL' ? conditionField : null,
        isActive: true,
        isCustom: true,
        createdById: req.user.id,
      },
    });

    // إنشاء سجلات تتبع لهذا العنصر في كل الدورات المفتوحة (غير المغلقة/المؤرشفة)
    const openCourses = await prisma.course.findMany({
      where: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      select: { id: true, requiresAdvance: true, requiresRevenue: true, materialsIssued: true, requiresAdvanceSettlement: true, requiresSupervisorCompensation: true, requiresTrainerCompensation: true, requiresPreTest: true, requiresPostTest: true, requiresOpeningReport: true, requiresClosingReport: true },
    });

    const trackingData = openCourses.map((course) => {
      let status = 'NOT_STARTED';
      if (type === 'CONDITIONAL' && created.conditionField) {
        status = course[created.conditionField] ? 'NOT_STARTED' : 'NOT_APPLICABLE';
      } else if (type === 'OPTIONAL') {
        status = 'NOT_APPLICABLE';
      }
      return { courseId: course.id, elementId: created.id, status };
    });

    if (trackingData.length) {
      await prisma.courseClosureTracking.createMany({ data: trackingData, skipDuplicates: true });
    }

    await logAudit(req.user.id, req.activeRole, 'CLOSURE_ELEMENT_CREATED', { elementId: created.id, name: created.name, elementType: type, affectedCourses: trackingData.length }, null);

    return res.status(201).json(created);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withManager(handler));
module.exports.default = module.exports;
