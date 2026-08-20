// =============================================================
// نقطة الدخول الموحّدة لطبقة الـ HTTP (للمعمارية المعيارية)
// تجمع وسائط المصادقة/الأدوار + التحقّق + مساعدات الاستجابة.
//
// مثال:
//   const { withMethods, withManager, withValidation, ok, created, fail }
//     = require('../../../lib/server/http');
// =============================================================
const { withAuth, withManager, withManagerOrSupervisor, withActiveRole, withMethods } = require('../../middleware/auth');
const { withValidation } = require('./withValidation');
const { ok, created, fail } = require('./respond');

module.exports = {
  withAuth,
  withManager,
  withManagerOrSupervisor,
  withActiveRole,
  withMethods,
  withValidation,
  ok,
  created,
  fail,
};
