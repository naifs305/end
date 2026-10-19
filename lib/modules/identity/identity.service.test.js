import { describe, it, expect, vi, beforeEach } from 'vitest';
// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./identity.service');
const repo = require('./identity.repo');
const audit = require('../../services/audit');
const ldapAuth = require('../../ldap/auth');
const config = require('../config/config.service');
const email = require('../../email');
const { hashPassword, verifyToken, verifyMfaToken } = require('../../auth/jwt');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع المشتركة وسجل التدقيق.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = [
  'findByEmailInsensitive', 'findByIdWithProject', 'findFreshForRefresh', 'findByIdSelect',
  'findByResetToken', 'findPasswordHash', 'countUsers', 'findManyUsers', 'createUser',
  'updateUser', 'updateUserRaw', 'setResetToken', 'resetPasswordByToken', 'setPasswordBumpVersion',
  'countCoursesForPrimary', 'deactivateUser', 'purgeUser', 'findProjectById',
  'findSupervisorByUserId', 'upsertSupervisor', 'deleteSupervisor', 'listSupervisors',
  'setLoginOtp', 'reserveOtpAttempt', 'consumeLoginOtp', 'clearLoginOtp',
];

// إعدادات افتراضية للاختبارات: التحقق الثنائي معطّل ما لم يُفعّله الاختبار
let SETTINGS = {};

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
  // بلا AD مُهيّأ افتراضياً — كل اختبار يُفعّله صراحةً عند الحاجة
  vi.spyOn(ldapAuth, 'ldapAuthenticate').mockResolvedValue(null);
  SETTINGS = { 'auth.mfa.enabled': 'false' };
  vi.spyOn(config, 'getSetting').mockImplementation(async (key, fallback) => (key in SETTINGS ? SETTINGS[key] : fallback));
  vi.spyOn(email, 'sendLoginOtp').mockResolvedValue({ id: 'msg-1' });
});

const MANAGER = { userId: 'mgr-1', activeRole: 'MANAGER', user: { id: 'mgr-1', roles: ['MANAGER'] } };
const EMPLOYEE = { userId: 'emp-1', activeRole: 'EMPLOYEE', user: { id: 'emp-1', roles: ['EMPLOYEE'] } };

describe('identity.service', () => {
  describe('updateUser — allowlist (H9)', () => {
    it('strips disallowed fields and only persists the basic-info allowlist', async () => {
      const target = { id: 'emp-1', roles: ['EMPLOYEE'], operationalProjectId: 'p1' };
      repo.findByIdSelect.mockResolvedValue(target);
      repo.updateUser.mockResolvedValue({ id: 'emp-1' });

      // الموظف يعدّل نفسه — مسموح بالمعلومات الأساسية فقط
      await svc.updateUser('emp-1', {
        firstName: 'علي',
        mobileNumber: '0500000000',
        // حقول حساسة يجب تجاهلها تماماً:
        email: 'hacker@x.com',
        passwordHash: 'pwned',
        isActive: false,
        operationalProjectId: 'p2',
        roles: ['MANAGER'],
        tokenVersion: 99,
      }, EMPLOYEE);

      expect(repo.updateUser).toHaveBeenCalledTimes(1);
      const persisted = repo.updateUser.mock.calls[0][1];
      expect(persisted).toEqual({ firstName: 'علي', mobileNumber: '0500000000' });
      // لا تسرّب لأي حقل حساس (بما فيها roles لأن الفاعل ليس مديراً)
      expect(persisted).not.toHaveProperty('email');
      expect(persisted).not.toHaveProperty('passwordHash');
      expect(persisted).not.toHaveProperty('isActive');
      expect(persisted).not.toHaveProperty('operationalProjectId');
      expect(persisted).not.toHaveProperty('roles');
      expect(persisted).not.toHaveProperty('tokenVersion');
    });

    it('lets a MANAGER also change roles through the protected path', async () => {
      const target = { id: 'emp-1', roles: ['EMPLOYEE'], operationalProjectId: 'p1' };
      repo.findByIdSelect.mockResolvedValue(target);
      repo.updateUser.mockResolvedValue({ id: 'emp-1' });

      await svc.updateUser('emp-1', { firstName: 'سارة', roles: ['EMPLOYEE', 'PROJECT_SUPERVISOR'] }, MANAGER);

      const persisted = repo.updateUser.mock.calls[0][1];
      expect(persisted).toEqual({ firstName: 'سارة', roles: ['EMPLOYEE', 'PROJECT_SUPERVISOR'] });
    });

    it('lets a MANAGER change the operational project and the active status', async () => {
      const target = { id: 'emp-1', roles: ['EMPLOYEE'], operationalProjectId: 'p1' };
      repo.findByIdSelect.mockResolvedValue(target);
      repo.updateUser.mockResolvedValue({ id: 'emp-1' });

      await svc.updateUser('emp-1', {
        firstName: 'نورة',
        operationalProjectId: 'p2',
        isActive: false,
      }, MANAGER);

      const persisted = repo.updateUser.mock.calls[0][1];
      expect(persisted).toEqual({ firstName: 'نورة', operationalProjectId: 'p2', isActive: false });
    });

    it('a non-manager cannot change roles (roles silently dropped)', async () => {
      const target = { id: 'emp-1', roles: ['EMPLOYEE'], operationalProjectId: 'p1' };
      repo.findByIdSelect.mockResolvedValue(target);
      repo.updateUser.mockResolvedValue({ id: 'emp-1' });

      await svc.updateUser('emp-1', { firstName: 'خالد', roles: ['MANAGER'] }, EMPLOYEE);

      const persisted = repo.updateUser.mock.calls[0][1];
      expect(persisted).toEqual({ firstName: 'خالد' });
      expect(persisted).not.toHaveProperty('roles');
    });

    it('throws 404 when the target user does not exist', async () => {
      repo.findByIdSelect.mockResolvedValue(null);
      await expect(svc.updateUser('missing', { firstName: 'x' }, MANAGER)).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser — manager only, courses protect the record', () => {
    it('refuses a non-manager', async () => {
      await expect(svc.deleteUser('emp-1', EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.purgeUser).not.toHaveBeenCalled();
      expect(repo.deactivateUser).not.toHaveBeenCalled();
    });

    it('refuses deleting your own account', async () => {
      await expect(svc.deleteUser('mgr-1', MANAGER)).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.purgeUser).not.toHaveBeenCalled();
    });

    it('deactivates instead of deleting when the user owns courses', async () => {
      repo.findByIdSelect.mockResolvedValue({ id: 'emp-1' });
      repo.countCoursesForPrimary.mockResolvedValue(3);
      const res = await svc.deleteUser('emp-1', MANAGER);
      expect(res.action).toBe('deactivated');
      expect(repo.deactivateUser).toHaveBeenCalledWith('emp-1');
      expect(repo.purgeUser).not.toHaveBeenCalled();
    });

    it('purges the account when it owns no courses', async () => {
      repo.findByIdSelect.mockResolvedValue({ id: 'emp-1' });
      repo.countCoursesForPrimary.mockResolvedValue(0);
      const res = await svc.deleteUser('emp-1', MANAGER);
      expect(res.action).toBe('deleted');
      expect(repo.purgeUser).toHaveBeenCalledWith('emp-1');
    });
  });

  describe('resetPassword — token reset (H4)', () => {
    it('increments tokenVersion and clears the token via repo.resetPasswordByToken', async () => {
      repo.findByResetToken.mockResolvedValue({ id: 'u-9', isActive: true });

      const result = await svc.resetPassword({ token: 'tok-123', password: 'Abcdef12' });

      expect(repo.findByResetToken).toHaveBeenCalledWith('tok-123');
      expect(repo.resetPasswordByToken).toHaveBeenCalledTimes(1);
      // الوسيط الأول هو معرف المستخدم، والثاني هو الـ hash؛ التصفير/الزيادة في طبقة المستودع
      expect(repo.resetPasswordByToken.mock.calls[0][0]).toBe('u-9');
      expect(typeof repo.resetPasswordByToken.mock.calls[0][1]).toBe('string');
      expect(result).toMatchObject({ message: expect.any(String) });
    });

    it('rejects an invalid/expired token with 400 and never resets', async () => {
      repo.findByResetToken.mockResolvedValue(null);
      await expect(svc.resetPassword({ token: 'bad', password: 'Abcdef12' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'serverErrors.auth.resetTokenInvalid' });
      expect(repo.resetPasswordByToken).not.toHaveBeenCalled();
    });

    it('rejects a weak password with the validation code before touching the token', async () => {
      await expect(svc.resetPassword({ token: 'tok', password: 'short' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'serverErrors.common.validation' });
      expect(repo.findByResetToken).not.toHaveBeenCalled();
    });
  });

  describe('adminResetPassword — role gate', () => {
    it('forbids a non-manager from resetting another user (403)', async () => {
      // المشرف يحاول إعادة تعيين كلمة مرور مدير — ممنوع
      repo.findByIdSelect.mockResolvedValue({ id: 'mgr-2', roles: ['MANAGER'], operationalProjectId: 'p1' });
      const SUPERVISOR = { userId: 'sup-1', activeRole: 'PROJECT_SUPERVISOR', user: { id: 'sup-1', roles: ['PROJECT_SUPERVISOR'] } };

      await expect(svc.adminResetPassword('mgr-2', { password: 'Abcdef12' }, SUPERVISOR))
        .rejects.toMatchObject({ statusCode: 403 });
      expect(repo.setPasswordBumpVersion).not.toHaveBeenCalled();
    });

    it('a MANAGER can reset and the version is bumped (H4)', async () => {
      repo.findByIdSelect.mockResolvedValue({ id: 'emp-1', roles: ['EMPLOYEE'], operationalProjectId: 'p1' });
      await svc.adminResetPassword('emp-1', { password: 'Abcdef12' }, MANAGER);
      expect(repo.setPasswordBumpVersion).toHaveBeenCalledTimes(1);
      expect(repo.setPasswordBumpVersion.mock.calls[0][0]).toBe('emp-1');
    });
  });

  describe('forgotPassword — account-enumeration mitigation', () => {
    it('returns 200-style success even when the account does not exist', async () => {
      repo.findByEmailInsensitive.mockResolvedValue(null);
      const res = await svc.forgotPassword({ email: 'nobody@x.com' });
      expect(res).toMatchObject({ message: expect.any(String) });
      expect(repo.setResetToken).not.toHaveBeenCalled();
    });
  });

  describe('login — Active Directory first, then local password', () => {
    const baseUser = {
      id: 'u-1', email: 'ahmed@nauss.edu.sa', firstName: 'أحمد', lastName: 'العتيبي',
      roles: ['EMPLOYEE'], isActive: true, tokenVersion: 0,
      operationalProject: { id: 'p1', name: 'مشروع' },
    };

    it('falls back to local password when AD is not configured (ldapAuthenticate resolves null)', async () => {
      const passwordHash = await hashPassword('Abcdef12');
      repo.findByEmailInsensitive.mockResolvedValue({ ...baseUser, passwordHash });

      const res = await svc.login({ email: 'ahmed@nauss.edu.sa', password: 'Abcdef12' });

      expect(ldapAuth.ldapAuthenticate).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ access_token: expect.any(String) });
      expect(repo.updateUserRaw).not.toHaveBeenCalled();
    });

    it('rejects the local path with the same message on a wrong password (no AD account-existence leak)', async () => {
      const passwordHash = await hashPassword('Abcdef12');
      repo.findByEmailInsensitive.mockResolvedValue({ ...baseUser, passwordHash });

      await expect(svc.login({ email: 'ahmed@nauss.edu.sa', password: 'wrong' }))
        .rejects.toMatchObject({ statusCode: 401, code: 'serverErrors.auth.invalidCredentials' });
    });

    it('AD authenticates but no local account exists for that email — rejected, no account created', async () => {
      ldapAuth.ldapAuthenticate.mockResolvedValue({
        dn: 'CN=ahmed,DC=nauss1,DC=edu,DC=sa', username: 'ahmed', email: 'ahmed@nauss.edu.sa',
        firstName: 'أحمد', lastName: 'العتيبي', displayName: 'أحمد العتيبي', mobile: null, extension: null,
      });
      repo.findByEmailInsensitive.mockResolvedValue(null);

      await expect(svc.login({ email: 'ahmed@nauss.edu.sa', password: 'whatever-ad-password' }))
        .rejects.toMatchObject({ statusCode: 401, code: 'serverErrors.auth.invalidCredentials' });
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it('AD authenticates but the matching local account is disabled — rejected (local disable overrides AD)', async () => {
      ldapAuth.ldapAuthenticate.mockResolvedValue({
        dn: 'CN=ahmed,DC=nauss1,DC=edu,DC=sa', username: 'ahmed', email: 'ahmed@nauss.edu.sa',
        firstName: 'أحمد', lastName: 'العتيبي', displayName: 'أحمد العتيبي', mobile: null, extension: null,
      });
      repo.findByEmailInsensitive.mockResolvedValue({ ...baseUser, passwordHash: 'x', isActive: false });

      await expect(svc.login({ email: 'ahmed@nauss.edu.sa', password: 'whatever-ad-password' }))
        .rejects.toMatchObject({ statusCode: 401, code: 'serverErrors.auth.invalidCredentials' });
    });

    it('AD authenticates and a matching active local account exists — succeeds without checking the local password', async () => {
      ldapAuth.ldapAuthenticate.mockResolvedValue({
        dn: 'CN=ahmed,DC=nauss1,DC=edu,DC=sa', username: 'ahmed', email: 'ahmed@nauss.edu.sa',
        firstName: 'أحمد الجديد', lastName: 'العتيبي', displayName: 'أحمد الجديد العتيبي', mobile: null, extension: null,
      });
      // hash محلي عشوائي غير مطابق للكلمة المُدخلة عمداً — يجب ألا يُفحص إطلاقاً على مسار AD
      repo.findByEmailInsensitive.mockResolvedValue({ ...baseUser, passwordHash: 'unrelated-hash' });

      const res = await svc.login({ email: 'ahmed@nauss.edu.sa', password: 'whatever-ad-password' });

      expect(res).toMatchObject({ access_token: expect.any(String) });
      // الاسم يُحدَّث من AD لأنه تغيّر
      expect(repo.updateUserRaw).toHaveBeenCalledWith('u-1', { firstName: 'أحمد الجديد' });
    });
  });

  describe('email OTP two-step verification', () => {
    const user = {
      id: 'u-1', email: 'ahmed@nauss.edu.sa', firstName: 'أحمد', lastName: 'العتيبي',
      roles: ['EMPLOYEE'], isActive: true, tokenVersion: 3,
      operationalProject: { id: 'p1', name: 'مشروع' },
    };

    async function challenge(extra = {}) {
      SETTINGS = { 'auth.mfa.enabled': 'true', ...extra };
      const passwordHash = await hashPassword('Abcdef12');
      repo.findByEmailInsensitive.mockResolvedValue({ ...user, passwordHash });
      const res = await svc.login({ email: user.email, password: 'Abcdef12' });
      const [, otpHash, otpExpiry] = repo.setLoginOtp.mock.calls.at(-1);
      const code = email.sendLoginOtp.mock.calls.at(-1)[0].code;
      return { res, otpHash, otpExpiry, code };
    }

    it('returns a challenge (no session token) and emails a 6-digit code from the default sender', async () => {
      const { res, otpHash, code } = await challenge();

      expect(res).toMatchObject({ mfaRequired: true, email: 'ah•••@nauss.edu.sa' });
      expect(res).not.toHaveProperty('access_token');
      expect(code).toMatch(/^\d{6}$/);
      expect(otpHash).not.toContain(code);
      expect(email.sendLoginOtp).toHaveBeenCalledWith(expect.objectContaining({ to: user.email, fromAddress: 'od@nauss.edu.sa' }));
    });

    it('uses the sender email configured in settings', async () => {
      await challenge({ 'auth.mfa.from': 'otp@nauss.edu.sa' });
      expect(email.sendLoginOtp.mock.calls[0][0].fromAddress).toBe('otp@nauss.edu.sa');
    });

    it('the challenge token cannot be used as a session token', async () => {
      const { res } = await challenge();
      expect(verifyToken(res.mfaToken)).toBeNull();
      expect(verifyMfaToken(res.mfaToken)).toMatchObject({ sub: 'u-1', tokenVersion: 3 });
    });

    it('verifies the correct code and issues a session', async () => {
      const { res, otpHash, otpExpiry, code } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, otpHash, otpExpiry, otpAttempts: 0 });
      repo.reserveOtpAttempt.mockResolvedValue(1);
      repo.consumeLoginOtp.mockResolvedValue(1);

      const session = await svc.verifyLoginOtp({ mfaToken: res.mfaToken, code });

      expect(session).toMatchObject({ access_token: expect.any(String), user: { id: 'u-1' } });
      expect(repo.consumeLoginOtp).toHaveBeenCalledWith('u-1', otpHash);
    });

    it('rejects a wrong code without consuming the OTP', async () => {
      const { res, otpHash, otpExpiry, code } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, otpHash, otpExpiry });
      repo.reserveOtpAttempt.mockResolvedValue(1);
      const wrong = code === '000000' ? '111111' : '000000';

      await expect(svc.verifyLoginOtp({ mfaToken: res.mfaToken, code: wrong }))
        .rejects.toMatchObject({ statusCode: 400, code: 'serverErrors.auth.otpInvalid' });
      expect(repo.consumeLoginOtp).not.toHaveBeenCalled();
    });

    it('locks the code once attempts are exhausted', async () => {
      const { res, otpHash, otpExpiry, code } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, otpHash, otpExpiry });
      repo.reserveOtpAttempt.mockResolvedValue(0);

      await expect(svc.verifyLoginOtp({ mfaToken: res.mfaToken, code }))
        .rejects.toMatchObject({ code: 'serverErrors.auth.otpTooManyAttempts' });
      expect(repo.clearLoginOtp).toHaveBeenCalledWith('u-1');
    });

    it('rejects an expired code', async () => {
      const { res, otpHash, code } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, otpHash, otpExpiry: new Date(Date.now() - 1000) });

      await expect(svc.verifyLoginOtp({ mfaToken: res.mfaToken, code }))
        .rejects.toMatchObject({ code: 'serverErrors.auth.otpExpired' });
    });

    it('rejects the challenge after a password change (tokenVersion bumped)', async () => {
      const { res, otpHash, otpExpiry, code } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, tokenVersion: 4, otpHash, otpExpiry });

      await expect(svc.verifyLoginOtp({ mfaToken: res.mfaToken, code }))
        .rejects.toMatchObject({ statusCode: 401, code: 'serverErrors.auth.mfaSessionInvalid' });
    });

    it('enforces the resend cooldown', async () => {
      const { res, otpHash, otpExpiry } = await challenge();
      repo.findByIdWithProject.mockResolvedValue({ ...user, otpHash, otpExpiry });

      await expect(svc.resendLoginOtp({ mfaToken: res.mfaToken }))
        .rejects.toMatchObject({ statusCode: 429, code: 'serverErrors.auth.otpResendTooSoon' });
    });

    it('fails closed when the email cannot be delivered', async () => {
      email.sendLoginOtp.mockResolvedValue(null);
      await expect(challenge()).rejects.toMatchObject({ statusCode: 503, code: 'serverErrors.auth.otpSendFailed' });
      expect(repo.clearLoginOtp).toHaveBeenCalledWith('u-1');
    });

    it('MFA_ENABLED=false in the environment bypasses the challenge (break-glass)', async () => {
      vi.stubEnv('MFA_ENABLED', 'false');
      try {
        SETTINGS = { 'auth.mfa.enabled': 'true' };
        const passwordHash = await hashPassword('Abcdef12');
        repo.findByEmailInsensitive.mockResolvedValue({ ...user, passwordHash });

        const res = await svc.login({ email: user.email, password: 'Abcdef12' });

        expect(res).toMatchObject({ access_token: expect.any(String) });
        expect(email.sendLoginOtp).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('createDirectoryUser — add an employee via AD (MANAGER only)', () => {
    const dto = {
      firstName: 'سارة', lastName: 'القحطاني', email: 'sarah@nauss.edu.sa',
      mobileNumber: '0500000000', extensionNumber: null,
      operationalProjectId: 'p1', roles: ['EMPLOYEE'],
    };

    it('forbids a non-manager (403), never touches the repo', async () => {
      await expect(svc.createDirectoryUser(dto, EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email before creating (matches register()\'s convention)', async () => {
      repo.findByEmailInsensitive.mockResolvedValue({ id: 'existing' });
      await expect(svc.createDirectoryUser(dto, MANAGER))
        .rejects.toMatchObject({ statusCode: 400, code: 'serverErrors.auth.emailAlreadyUsed' });
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it('creates the user with passwordHash: null and the given roles/project', async () => {
      repo.findByEmailInsensitive.mockResolvedValue(null);
      repo.createUser.mockResolvedValue({
        id: 'u-new', email: 'sarah@nauss.edu.sa', firstName: 'سارة', lastName: 'القحطاني',
        mobileNumber: '0500000000', extensionNumber: null, roles: ['EMPLOYEE'], isActive: true,
        operationalProject: { id: 'p1', name: 'مشروع' },
      });

      const res = await svc.createDirectoryUser(dto, MANAGER);

      expect(repo.createUser).toHaveBeenCalledTimes(1);
      const persisted = repo.createUser.mock.calls[0][0];
      expect(persisted).toMatchObject({ passwordHash: null, email: 'sarah@nauss.edu.sa', operationalProjectId: 'p1', roles: ['EMPLOYEE'] });
      expect(res).toMatchObject({ id: 'u-new', isDirectoryAccount: true });
    });
  });

  describe('listUsers — flags directory (AD-only) accounts without leaking the hash', () => {
    it('marks passwordHash === null as isDirectoryAccount and strips the raw hash field', async () => {
      repo.countUsers.mockResolvedValue(2);
      repo.findManyUsers.mockResolvedValue([
        { id: 'u-1', email: 'a@nauss.edu.sa', passwordHash: 'some-bcrypt-hash' },
        { id: 'u-2', email: 'b@nauss.edu.sa', passwordHash: null },
      ]);

      const { data } = await svc.listUsers(MANAGER);

      expect(data).toEqual([
        { id: 'u-1', email: 'a@nauss.edu.sa', isDirectoryAccount: false },
        { id: 'u-2', email: 'b@nauss.edu.sa', isDirectoryAccount: true },
      ]);
      expect(data[0]).not.toHaveProperty('passwordHash');
      expect(data[1]).not.toHaveProperty('passwordHash');
    });
  });
});
