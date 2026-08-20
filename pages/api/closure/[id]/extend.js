// POST /api/closure/[id]/extend
// المدير فقط — منح تمديد لموعد عنصر إقفال محدد
const { withMethods, withManager, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const { isPositiveInt, isNonEmptyString } = require('../../../../lib/middleware/validate');

async function handler(req, res) {
  const { id } = req.query;
  const { extensionHours, extensionReason } = req.body || {};

  if (!isPositiveInt(extensionHours) || Number(extensionHours) === 0) {
    return res.status(400).json({ message: 'عدد ساعات التمديد يجب أن يكون رقماً موجباً', code: 'serverErrors.closure.extensionHoursInvalid' });
  }
  if (!isNonEmptyString(extensionReason, 500)) {
    return res.status(400).json({ message: 'سبب التمديد مطلوب', code: 'serverErrors.closure.extensionReasonRequired' });
  }

  try {
    return ok(res, await svc.extendElement(id, { extensionHours, extensionReason }, req.user));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
