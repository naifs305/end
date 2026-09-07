// ─────────────────────────────────────────────────────────────
// البحث في دليل Active Directory — لمساعدة المدير على اختيار موظف
// من شاشة إدارة المستخدمين. منفصل عن المصادقة في lib/ldap/auth.js.
// منقول عن مشروع solf (lib/ldap-search.ts).
// ─────────────────────────────────────────────────────────────
const { Client } = require('ldapts');
const { escapeLdapFilter } = require('./filter');
const { isLdapConfigured } = require('./auth');

const LDAP_URL = process.env.LDAP_URL || '';
const LDAP_BIND_DN = process.env.LDAP_BIND_DN || '';
const LDAP_BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD || '';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'DC=nauss1,DC=edu,DC=sa';

const MIN_DIRECTORY_QUERY_LENGTH = 2;

const asText = (value) => (Array.isArray(value) ? String(value[0]) : value ? String(value) : null);

/**
 * يبحث عن المستخدمين الفعّالين في AD بالاسم أو اسم المستخدم أو البريد.
 * يُرجع مصفوفة فارغة عند أي خطأ — لا يكشف تفاصيل الدليل.
 */
async function ldapSearchUsers(query, limit = 20) {
  const q = String(query || '').trim();
  if (q.length < MIN_DIRECTORY_QUERY_LENGTH) return [];
  if (!isLdapConfigured) return [];

  const client = new Client({ url: LDAP_URL, timeout: 10_000, connectTimeout: 10_000 });

  try {
    await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const e = escapeLdapFilter(q);
    const { searchEntries } = await client.search(LDAP_BASE_DN, {
      scope: 'sub',
      filter:
        `(&(objectClass=user)(objectCategory=person)` +
        `(|(displayName=*${e}*)(sAMAccountName=*${e}*)(mail=*${e}*)(givenName=*${e}*)(sn=*${e}*))` +
        `(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`, // استبعاد المعطلين
      attributes: ['sAMAccountName', 'mail', 'givenName', 'sn', 'displayName', 'mobile', 'telephoneNumber'],
      sizeLimit: Math.max(limit * 2, 50),
    });

    return searchEntries
      .filter((entry) => asText(entry.sAMAccountName))
      .map((entry) => ({
        username: asText(entry.sAMAccountName),
        email: asText(entry.mail),
        firstName: asText(entry.givenName),
        lastName: asText(entry.sn),
        displayName: asText(entry.displayName),
        mobile: asText(entry.mobile),
        extension: asText(entry.telephoneNumber),
      }))
      .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'ar'))
      .slice(0, limit);
  } catch (error) {
    console.error('[ldap] directory search error:', error instanceof Error ? error.message : 'unknown');
    return [];
  } finally {
    await client.unbind().catch(() => {});
  }
}

module.exports = { ldapSearchUsers, MIN_DIRECTORY_QUERY_LENGTH };
