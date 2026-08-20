import { describe, it, expect, vi, beforeEach } from 'vitest';

// نستخدم require (CommonJS) لوحدة الاختبار والمستودع حتى يتشارك الاختبار
// والخدمة نفس كائن module.exports (الخدمة تستورد المستودع عبر require)؛
// فيراه التجسّس (spyOn) من الطرفين. أما أدوات vitest فتُستورد عبر import.
const svc = require('./closure.service');
const repo = require('./closure.repo');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const notifications = require('../../services/notifications');
const emailService = require('../../services/emailService');

// نعزل الخدمة عن قاعدة البيانات والخدمات المشتركة بالتجسّس على دوال المستودع.
const REPO_METHODS = [
  'findTrackingByCourse',
  'setCourseStatus',
  'findTrackingWithElementAndCourse',
  'findTrackingById',
  'updateManyByStatus',
  'updateManyNotInStatus',
];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
  vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
  vi.spyOn(emailService, 'sendElementReturnedEmail').mockResolvedValue(undefined);
  vi.spyOn(emailService, 'sendElementRejectedEmail').mockResolvedValue(undefined);
  // افتراضياً تُرجع findTrackingByCourse مصفوفة فارغة حتى لا يقفل checkCourseClosure الدورة
  repo.findTrackingByCourse.mockResolvedValue([]);
});

const EXECUTOR = { id: 'u-exec', email: 'exec@nauss.edu.sa' };
const SUPERVISOR = { id: 'u-sup', email: 'sup@nauss.edu.sa' };

// عنصر بانتظار قرار، نفّذه المستخدم EXECUTOR
function pendingItem(overrides = {}) {
  return {
    id: 't1',
    courseId: 'c1',
    status: 'PENDING_APPROVAL',
    executedById: EXECUTOR.id,
    formData: null,
    notes: null,
    element: { key: 'opening_report', name: 'تقرير الافتتاح' },
    course: { id: 'c1', name: 'دورة', primaryEmployeeId: 'emp-1', supportingTeam: [] },
    ...overrides,
  };
}

describe('closure.service.updateStatus', () => {
  // C6 — فصل المهام: المنفِّذ لا يستطيع اتخاذ القرار على عنصر نفّذه (403)
  describe('separation of duties (C6)', () => {
    it('forbids the executor from deciding an element they executed (403) and never updates', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ executedById: EXECUTOR.id }));
      // مسموح له من حيث الدور باتخاذ القرار، لكن فصل المهام يمنعه لأنه هو المنفِّذ
      vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);

      await expect(
        svc.updateStatus('t1', { status: 'APPROVED' }, EXECUTOR, 'PROJECT_SUPERVISOR'),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(repo.updateManyByStatus).not.toHaveBeenCalled();
      expect(audit.logAudit).not.toHaveBeenCalled();
    });

    it('allows a different decider to approve the executor\'s element', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ executedById: EXECUTOR.id }));
      vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
      repo.updateManyByStatus.mockResolvedValue({ count: 1 });
      repo.findTrackingById.mockResolvedValue({ id: 't1', status: 'APPROVED' });

      const result = await svc.updateStatus('t1', { status: 'APPROVED' }, SUPERVISOR, 'PROJECT_SUPERVISOR');

      expect(repo.updateManyByStatus).toHaveBeenCalledWith('t1', 'PENDING_APPROVAL', expect.objectContaining({ status: 'APPROVED', decidedById: SUPERVISOR.id }));
      expect(audit.logAudit).toHaveBeenCalledWith(SUPERVISOR.id, 'PROJECT_SUPERVISOR', 'ELEMENT_APPROVED', expect.any(Object), 'c1');
      expect(result).toEqual({ id: 't1', status: 'APPROVED' });
    });
  });

  // C5 — انتقالات الحالة: التقديم/القرار من حالة غير صالحة يُرفض
  describe('submit from invalid status (C5)', () => {
    it('rejects submitting an already APPROVED element (400) and never updates', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ status: 'APPROVED', executedById: null }));
      vi.spyOn(permissions, 'canSubmitElement').mockResolvedValue(true);

      await expect(
        svc.updateStatus('t1', { status: 'PENDING_APPROVAL', formData: {} }, EXECUTOR, 'EMPLOYEE'),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.updateManyByStatus).not.toHaveBeenCalled();
    });

    it('returns 409 when the atomic guard (H7) finds the row changed concurrently', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ status: 'NOT_STARTED', executedById: null }));
      vi.spyOn(permissions, 'canSubmitElement').mockResolvedValue(true);
      // التحديث الذرّي لم يطابق أي صف → تغيّرت الحالة بالتزامن
      repo.updateManyByStatus.mockResolvedValue({ count: 0 });

      await expect(
        svc.updateStatus('t1', { status: 'PENDING_APPROVAL', formData: {} }, EXECUTOR, 'EMPLOYEE'),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(audit.logAudit).not.toHaveBeenCalled();
    });

    it('rejects a decision when the element is not PENDING_APPROVAL (400)', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ status: 'NOT_STARTED', executedById: null }));
      vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);

      await expect(
        svc.updateStatus('t1', { status: 'APPROVED' }, SUPERVISOR, 'PROJECT_SUPERVISOR'),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.updateManyByStatus).not.toHaveBeenCalled();
    });
  });

  // M9 — التدقيق: سحب العنصر يُسجِّل ELEMENT_WITHDRAWN
  describe('withdraw fires an audit entry (M9)', () => {
    it('withdraws a PENDING_APPROVAL element and writes an ELEMENT_WITHDRAWN audit', async () => {
      repo.findTrackingWithElementAndCourse.mockResolvedValue(pendingItem({ status: 'PENDING_APPROVAL', executedById: EXECUTOR.id }));
      vi.spyOn(permissions, 'canSubmitElement').mockResolvedValue(true);
      repo.updateManyByStatus.mockResolvedValue({ count: 1 });
      repo.findTrackingById.mockResolvedValue({ id: 't1', status: 'NOT_STARTED' });

      const result = await svc.updateStatus('t1', { status: 'NOT_STARTED' }, EXECUTOR, 'EMPLOYEE');

      expect(repo.updateManyByStatus).toHaveBeenCalledWith('t1', { in: ['PENDING_APPROVAL', 'RETURNED'] }, expect.objectContaining({ status: 'NOT_STARTED' }));
      expect(audit.logAudit).toHaveBeenCalledWith(EXECUTOR.id, 'EMPLOYEE', 'ELEMENT_WITHDRAWN', expect.objectContaining({ elementKey: 'opening_report' }), 'c1');
      expect(result).toEqual({ id: 't1', status: 'NOT_STARTED' });
    });
  });

  it('throws 404 when the tracking element is missing', async () => {
    repo.findTrackingWithElementAndCourse.mockResolvedValue(null);
    await expect(
      svc.updateStatus('missing', { status: 'APPROVED' }, SUPERVISOR, 'PROJECT_SUPERVISOR'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
