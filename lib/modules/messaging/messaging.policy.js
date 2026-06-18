// =============================================================
// صلاحيات وحدة المراسلة (RBAC Policy)
// كل المستخدمين المصادَقين يمكنهم المراسلة؛ الوصول للرسالة يُتحقَّق
// بكون المستخدم مستلِماً (يُفرض في الخدمة عبر سجل المستلم).
// =============================================================
const { AppError } = require('../../shared/AppError');

function assertCanAccessRecipientRecord(recipientRecord) {
  if (!recipientRecord) {
    throw AppError.forbidden('لا تملك صلاحية الوصول لهذه الرسالة');
  }
}

module.exports = { assertCanAccessRecipientRecord };
