// =============================================================
// صلاحيات وحدة بلاغات العوائق (RBAC Policy)
// -------------------------------------------------------------
// البلاغ لا يحتاج اعتماداً ليسري — فالصلاحيات هنا تحكم مَن يرفع
// ومَن يُغلق ومَن يبتّ فيما تجاوز الرصيد، لا مَن "يصدّق".
// =============================================================
const permissions = require('../../services/permissions');

function canDecideQuotaExceeded(activeRole) {
  return activeRole === 'MANAGER';
}

function canViewAllBlockers(activeRole) {
  return activeRole === 'MANAGER';
}

function canViewProjectBlockers(activeRole) {
  return ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);
}

module.exports = {
  canSubmitElement: permissions.canSubmitElement,
  canDecideElement: permissions.canDecideElement,
  canViewCourse: permissions.canViewCourse,
  canDecideQuotaExceeded,
  canViewAllBlockers,
  canViewProjectBlockers,
};
