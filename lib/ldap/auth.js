// ─────────────────────────────────────────────────────────────
// المصادقة عبر Active Directory.
// ربط بحساب الخدمة للبحث عن المستخدم، ثم ربط ثانٍ باسم المستخدم نفسه
// للتحقق من كلمة المرور. لا تُسجَّل كلمات المرور ولا بيانات الربط.
// منقول عن مشروع solf (lib/ldap.ts).
// ─────────────────────────────────────────────────────────────
const { Client } = require('ldapts');
const { escapeLdapFilter } = require('./filter');

const LDAP_URL = process.env.LDAP_URL || '';
const LDAP_BIND_DN = process.env.LDAP_BIND_DN || '';
const LDAP_BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD || '';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'DC=nauss1,DC=edu,DC=sa';

const isLdapConfigured = Boolean(LDAP_URL && LDAP_BIND_DN && LDAP_BIND_PASSWORD);

const asText = (value) => (Array.isArray(value) ? String(value[0]) : value ? String(value) : null);

/**
 * يتحقق من بيانات الدخول مقابل Active Directory.
 * يُرجع null عند أي فشل — لا يفرّق بين "غير موجود" و"كلمة مرور خاطئة".
 */
async function ldapAuthenticate(login, password) {
  // كلمة المرور الفارغة تعني ربطاً مجهولاً في LDAP و«ينجح» — يجب رفضها صراحةً
  if (!login || !String(login).trim() || !password) return null;
  if (!isLdapConfigured) return null;

  const serviceClient = new Client({ url: LDAP_URL, timeout: 10_000, connectTimeout: 10_000 });

  try {
    await serviceClient.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const u = escapeLdapFilter(String(login).trim());
    const { searchEntries } = await serviceClient.search(LDAP_BASE_DN, {
      scope: 'sub',
      filter:
        `(&(objectClass=user)(objectCategory=person)` +
        `(|(mail=${u})(sAMAccountName=${u})(userPrincipalName=${u}))` +
        `(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`, // استبعاد المعطلين
      attributes: [
        'distinguishedName',
        'sAMAccountName',
        'mail',
        'givenName',
        'sn',
        'displayName',
        'mobile',
        'telephoneNumber',
      ],
      sizeLimit: 2,
    });

    if (searchEntries.length !== 1) return null; // غير موجود أو ملتبس

    const entry = searchEntries[0];
    const userDn = entry.dn;

    // التحقق من كلمة المرور بالربط باسم المستخدم نفسه
    const userClient = new Client({ url: LDAP_URL, timeout: 10_000, connectTimeout: 10_000 });
    try {
      await userClient.bind(userDn, password);
    } catch {
      return null; // كلمة مرور خاطئة
    } finally {
      await userClient.unbind().catch(() => {});
    }

    return {
      dn: userDn,
      username: asText(entry.sAMAccountName),
      email: asText(entry.mail),
      firstName: asText(entry.givenName),
      lastName: asText(entry.sn),
      displayName: asText(entry.displayName),
      mobile: asText(entry.mobile),
      extension: asText(entry.telephoneNumber),
    };
  } catch (error) {
    // رسالة الخطأ فقط — لا بيانات اعتماد في السجلات
    console.error('[ldap] authentication error:', error instanceof Error ? error.message : 'unknown');
    return null;
  } finally {
    await serviceClient.unbind().catch(() => {});
  }
}

module.exports = { ldapAuthenticate, isLdapConfigured };
