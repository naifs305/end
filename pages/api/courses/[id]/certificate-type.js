// PUT /api/courses/[id]/certificate-type
// { certificateType: 'ATTENDANCE' | 'PASS' | 'PENDING', note? }
// يعيّنه منسق الدورة وفريقها، ومشرفها، والمدير. تأكيده يُنجز عنصر
// «تأكيد نوع الشهادة»، وتغييره بعد التأكيد يُسجَّل ويُبلَّغ به المشرف.
const { z } = require('zod');
const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');

const schema = z.object({
  certificateType: z.enum(['ATTENDANCE', 'PASS', 'PENDING'], { errorMap: () => ({ message: 'اختر نوع الشهادة' }) }),
  note: z.string().trim().max(500).optional(),
});

async function handler(req, res) {
  try {
    return await withValidation(schema, (r, s) =>
      svc.setCertificateType(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
