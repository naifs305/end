// =============================================================
// وسيط التحقّق من المدخلات عبر مخطّط zod
// عند النجاح يضع البيانات المُحلَّلة في req.valid، وإلا يردّ 400.
// =============================================================
const { fail } = require('./respond');

function withValidation(schema, handler) {
  return (req, res) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) return fail(res, result.error);
    req.valid = result.data;
    return handler(req, res);
  };
}

module.exports = { withValidation };
