-- حسابات Active Directory تُنشأ بلا كلمة مرور محلية (تصادق عبر LDAP حصراً)،
-- فيصبح الحقل اختيارياً بدلاً من إجباري.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
