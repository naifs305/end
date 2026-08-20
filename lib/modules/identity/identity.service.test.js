import { describe, it, expect, vi, beforeEach } from 'vitest';
// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./identity.service');
const repo = require('./identity.repo');
const audit = require('../../services/audit');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع المشتركة وسجل التدقيق.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = [
  'findByEmailInsensitive', 'findByIdWithProject', 'findFreshForRefresh', 'findByIdSelect',
  'findByResetToken', 'findPasswordHash', 'countUsers', 'findManyUsers', 'createUser',
  'updateUser', 'updateUserRaw', 'setResetToken', 'resetPasswordByToken', 'setPasswordBumpVersion',
  'countCoursesForPrimary', 'deactivateUser', 'purgeUser', 'findProjectById',
  'findSupervisorByUserId', 'upsertSupervisor', 'deleteSupervisor', 'listSupervisors',
];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
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
});
