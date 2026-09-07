// =============================================================
// GET /api/admin/ad-search?q=...
// -------------------------------------------------------------
// بحث في دليل Active Directory — لمساعدة المدير على اختيار موظف
// عند إضافته يدوياً. لا يُنشئ حسابات ولا يعدّلها.
// =============================================================
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const { fail } = require('../../../lib/server/http');
const { AppError } = require('../../../lib/shared/AppError');
const { isLdapConfigured } = require('../../../lib/ldap/auth');
const { ldapSearchUsers, MIN_DIRECTORY_QUERY_LENGTH } = require('../../../lib/ldap/search');
const prisma = require('../../../lib/db/prisma');

async function handler(req, res) {
  try {
    if (!isLdapConfigured) {
      throw AppError.badRequest('دليل Active Directory غير مُهيّأ', 'serverErrors.ldap.notConfigured');
    }

    const query = String(req.query.q || '').trim();
    if (query.length < MIN_DIRECTORY_QUERY_LENGTH) {
      return res.status(200).json({ results: [] });
    }

    const entries = await ldapSearchUsers(query, 20);

    // البريد المعتمد: mail من AD وإلا username@nauss.edu.sa — نفس منطق تسجيل الدخول
    const withEmail = entries.map((entry) => ({
      ...entry,
      email: (entry.email || `${entry.username}@nauss.edu.sa`).toLowerCase(),
    }));

    // تمييز من هو مضاف مسبقاً حتى لا يحاول المدير إضافته مرة أخرى
    const existing = await prisma.user.findMany({
      where: { email: { in: withEmail.map((entry) => entry.email) } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((user) => user.email));

    return res.status(200).json({
      results: withEmail.map((entry) => ({
        username: entry.username,
        email: entry.email,
        firstName: entry.firstName,
        lastName: entry.lastName,
        displayName: entry.displayName,
        mobile: entry.mobile,
        extension: entry.extension,
        alreadyAdded: existingEmails.has(entry.email),
      })),
    });
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withManager(withMethods(['GET'], handler));
module.exports.default = module.exports;
