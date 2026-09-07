import { describe, expect, it } from 'vitest';
const { escapeLdapFilter } = require('./filter');

const NUL = String.fromCharCode(0);
const BS = String.fromCharCode(92);

describe('escapeLdapFilter', () => {
  it('يترك القيم العادية دون تغيير', () => {
    expect(escapeLdapFilter('ahmed')).toBe('ahmed');
    expect(escapeLdapFilter('ahmed.alotaibi@nauss.edu.sa')).toBe('ahmed.alotaibi@nauss.edu.sa');
  });

  it('لا يمسّ العربية ولا المسافات', () => {
    expect(escapeLdapFilter('أحمد محمد')).toBe('أحمد محمد');
  });

  it('يهرّب المحارف الخاصة الأربعة', () => {
    expect(escapeLdapFilter('a*b')).toBe(`a${BS}2ab`);
    expect(escapeLdapFilter('a(b)c')).toBe(`a${BS}28b${BS}29c`);
    expect(escapeLdapFilter(BS)).toBe(`${BS}5c`);
  });

  it('يهرّب المحرف الصفري', () => {
    expect(escapeLdapFilter(NUL)).toBe(`${BS}00`);
  });

  it('يبطل محاولة حقن فلتر LDAP', () => {
    // بدون تهريب، هذا المدخل يغلق الفلتر ويضيف شرطاً خاصاً به
    expect(escapeLdapFilter('*)(&(objectClass=*')).toBe(
      `${BS}2a${BS}29${BS}28&${BS}28objectClass=${BS}2a`,
    );
    expect(escapeLdapFilter('*)(uid=*))(|(uid=*')).not.toContain('*)');
  });

  it('يهرّب كل التكرارات لا الأول فقط', () => {
    expect(escapeLdapFilter('**')).toBe(`${BS}2a${BS}2a`);
  });
});
