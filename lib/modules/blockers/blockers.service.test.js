import { describe, it, expect, vi, beforeEach } from 'vitest';

// نستخدم require (CommonJS) حتى يتشارك الاختبار والخدمة نفس كائن
// module.exports، فيراه التجسّس من الطرفين.
const svc = require('./blockers.service');
const repo = require('./blockers.repo');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const notifications = require('../../services/notifications');
const config = require('../config/config.service');

const REPO_METHODS = [
  'findTrackingForBlocker',
  'findBlockerById',
  'findOpenBlockerForTracking',
  'createBlocker',
  'updateBlocker',
  'countCreditedInQuarter',
  'findOversightRecipients',
];

const USER = { id: 'u1', firstName: 'نايف', lastName: 'الشهراني' };
const MANAGER = { id: 'm1', firstName: 'مدير', lastName: 'الإدارة' };

// دورة انتهت 2026-11-05، وعنصر مهلته المثالية +24 والأقصى +72
function tracking(overrides = {}) {
  return {
    id: 't1',
    courseId: 'c1',
    status: 'NOT_STARTED',
    extensionHours: null,
    executionAt: null,
    blockers: [],
    element: {
      id: 'e1',
      key: 'certificates',
      name: 'إصدار الشهادات',
      deadlineRefPoint: 'END',
      deadlineIdealHours: 24,
      deadlineMaxHours: 72,
      isDeadlineWorkingDays: false,
    },
    course: {
      id: 'c1',
      name: 'دورة تجريبية',
      operationalProjectId: 'p1',
      primaryEmployeeId: 'u1',
      startDate: new Date('2026-11-01T08:00:00.000Z'),
      endDate: new Date('2026-11-05T08:00:00.000Z'),
    },
    ...overrides,
  };
}

const VALID_DTO = {
  trackingId: 't1',
  reason: 'TRAINER_GRADES',
  awaitedParty: 'المدرب عبدالله',
  details: 'طلبت الدرجات يوم الأحد ولم تُسجَّل بعد',
};

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(repo, 'findOversightRecipients').mockResolvedValue([]);
  vi.spyOn(permissions, 'canSubmitElement').mockResolvedValue(true);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
  vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
  vi.spyOn(config, 'getSetting').mockResolvedValue('3');
});

describe('مفتاح الفصل', () => {
  it('يحسب الفصل الصحيح من التاريخ', () => {
    expect(svc.quarterKeyOf(new Date('2026-01-15'))).toBe('2026-Q1');
    expect(svc.quarterKeyOf(new Date('2026-05-15'))).toBe('2026-Q2');
    expect(svc.quarterKeyOf(new Date('2026-08-15'))).toBe('2026-Q3');
    expect(svc.quarterKeyOf(new Date('2026-11-12'))).toBe('2026-Q4');
  });

  it('يعيد مدى الفصل', () => {
    const r = svc.quarterRange('2026-Q4');
    expect(r.from.getMonth()).toBe(9);  // أكتوبر
    expect(r.to.getMonth()).toBe(11);   // ديسمبر
  });
});

describe('الرصيد الفصلي', () => {
  it('يحسب المتبقي', async () => {
    repo.countCreditedInQuarter.mockResolvedValue(1);
    const q = await svc.getQuotaStatus('u1', new Date('2026-11-12'));
    expect(q).toMatchObject({ quarterKey: '2026-Q4', quota: 3, used: 1, remaining: 2, exhausted: false });
  });

  it('يرصد نفاد الرصيد', async () => {
    repo.countCreditedInQuarter.mockResolvedValue(3);
    const q = await svc.getQuotaStatus('u1', new Date('2026-11-12'));
    expect(q).toMatchObject({ remaining: 0, exhausted: true });
  });
});

describe('رفع البلاغ — الحُرّاس', () => {
  it('يرفض بلاغاً على عنصر غير موجود', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(null);
    await expect(svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('يرفض بلاغاً من غير صاحب الصلاحية', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    permissions.canSubmitElement.mockResolvedValue(false);
    await expect(svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('يرفض بلاغاً على عنصر مُقدَّم — صاحبه غير متوقف', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking({ status: 'PENDING_APPROVAL' }));
    await expect(svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('يرفض بلاغاً على عنصر مُعتمد', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking({ status: 'APPROVED' }));
    await expect(svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('يقبل البلاغ على عنصر مُعاد للتصحيح', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking({ status: 'RETURNED' }));
    repo.countCreditedInQuarter.mockResolvedValue(0);
    repo.createBlocker.mockImplementation(async (data) => ({ id: 'b1', ...data }));
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));
    expect(res.isCredited).toBe(true);
  });

  it('يرفض بلاغاً ثانياً على عنصر له بلاغ قائم', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    repo.findOpenBlockerForTracking.mockResolvedValue({ id: 'b0' });
    await expect(svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('رفع البلاغ — السقف الفصلي', () => {
  beforeEach(() => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    repo.createBlocker.mockImplementation(async (data) => ({ id: 'b1', ...data }));
  });

  it('تحت السقف: يسري تلقائياً بلا اعتماد أحد', async () => {
    repo.countCreditedInQuarter.mockResolvedValue(2);
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));
    expect(res.isCredited).toBe(true);
    expect(res.credit).toBe('AUTO_APPROVED');
    expect(res.warnings.find((w) => w.code === 'QUOTA_EXCEEDED')).toBeUndefined();
  });

  it('فوق السقف: يُسجَّل وينتظر قرار المدير', async () => {
    repo.countCreditedInQuarter.mockResolvedValue(3);
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));
    expect(res.isCredited).toBe(false);
    expect(res.credit).toBe('QUOTA_EXCEEDED_PENDING');
    expect(res.warnings.find((w) => w.code === 'QUOTA_EXCEEDED')).toBeDefined();
  });

  it('يقرأ السقف من إعدادات المنصة', async () => {
    config.getSetting.mockResolvedValue('1');
    repo.countCreditedInQuarter.mockResolvedValue(1);
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));
    expect(res.isCredited).toBe(false);
  });
});

describe('رفع البلاغ — توقيت الرفع هو الحاسم', () => {
  beforeEach(() => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    repo.countCreditedInQuarter.mockResolvedValue(0);
    repo.createBlocker.mockImplementation(async (data) => ({ id: 'b1', ...data }));
  });

  it('البلاغ قبل الموعد المثالي بلا تحذير', async () => {
    // المثالي 11-06، فالرفع 11-04 في وقته
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));
    expect(res.warnings).toHaveLength(0);
  });

  it('البلاغ بعد المثالي يُنبّه أنه لا يُعيد التميّز', async () => {
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-07T08:00:00.000Z'));
    expect(res.warnings.find((w) => w.code === 'RAISED_AFTER_IDEAL')).toBeDefined();
  });

  it('البلاغ بعد الموعد الأقصى يُنبّه أنه لا يرفع العقوبة', async () => {
    // الأقصى 11-08، فالرفع 11-10 متأخر
    const res = await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-10T08:00:00.000Z'));
    expect(res.warnings.find((w) => w.code === 'RAISED_AFTER_DEADLINE')).toBeDefined();
  });

  it('يسجّل في التدقيق أن البلاغ رُفع بعد فوات الموعد', async () => {
    await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-10T08:00:00.000Z'));
    expect(audit.logAudit).toHaveBeenCalledWith(
      'u1', 'EMPLOYEE', 'BLOCKER_RAISED',
      expect.objectContaining({ tooLateToCredit: true }),
      'c1',
    );
  });
});

describe('النشر هو الحارس', () => {
  it('يُشعر المديرين والمشرفين فور رفع البلاغ', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    repo.countCreditedInQuarter.mockResolvedValue(0);
    repo.createBlocker.mockImplementation(async (data) => ({ id: 'b1', ...data }));
    repo.findOversightRecipients.mockResolvedValue(['m1', 's1']);

    await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));

    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    const [, type, title, body] = notifications.createNotification.mock.calls[0];
    expect(type).toBe('BLOCKER_RAISED');
    expect(title).toContain('إصدار الشهادات');
    expect(body).toContain('المدرب عبدالله'); // الجهة منسوبة بالاسم
  });

  it('لا يُشعر رافع البلاغ نفسه', async () => {
    repo.findTrackingForBlocker.mockResolvedValue(tracking());
    repo.countCreditedInQuarter.mockResolvedValue(0);
    repo.createBlocker.mockImplementation(async (data) => ({ id: 'b1', ...data }));
    repo.findOversightRecipients.mockResolvedValue(['u1', 'm1']);

    await svc.raiseBlocker(VALID_DTO, USER, 'EMPLOYEE', new Date('2026-11-04T08:00:00.000Z'));

    const recipients = notifications.createNotification.mock.calls.map((c) => c[0]);
    expect(recipients).not.toContain('u1');
    expect(recipients).toContain('m1');
  });
});

describe('إغلاق البلاغ', () => {
  const openBlocker = {
    id: 'b1',
    raisedById: 'u1',
    courseId: 'c1',
    status: 'OPEN',
    raisedAt: new Date('2026-11-04T08:00:00.000Z'),
    tracking: { element: { name: 'إصدار الشهادات' } },
    course: { name: 'دورة تجريبية' },
  };

  it('صاحب البلاغ يُغلقه', async () => {
    repo.findBlockerById.mockResolvedValue(openBlocker);
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
    const res = await svc.resolveBlocker('b1', {}, USER, 'EMPLOYEE', new Date('2026-11-06T08:00:00.000Z'));
    expect(res.status).toBe('RESOLVED');
    expect(res.resolvedAt).toEqual(new Date('2026-11-06T08:00:00.000Z'));
  });

  it('مشرف مشروع الدورة يستطيع إغلاقه', async () => {
    repo.findBlockerById.mockResolvedValue({ ...openBlocker, course: { id: 'c1', operationalProjectId: 'p1' } });
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
    await expect(
      svc.resolveBlocker('b1', {}, { id: 'other' }, 'PROJECT_SUPERVISOR'),
    ).resolves.toBeDefined();
  });

  it('مشرف مشروع آخر لا يستطيع إغلاقه', async () => {
    repo.findBlockerById.mockResolvedValue({ ...openBlocker, course: { id: 'c1', operationalProjectId: 'p1' } });
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(false);
    await expect(
      svc.resolveBlocker('b1', {}, { id: 'other' }, 'PROJECT_SUPERVISOR'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('أجنبي لا يستطيع إغلاقه', async () => {
    repo.findBlockerById.mockResolvedValue(openBlocker);
    await expect(
      svc.resolveBlocker('b1', {}, { id: 'other' }, 'EMPLOYEE'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('لا يُغلق بلاغاً مغلقاً', async () => {
    repo.findBlockerById.mockResolvedValue({ ...openBlocker, status: 'RESOLVED' });
    await expect(svc.resolveBlocker('b1', {}, USER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('السحب يُلغي الاحتساب', async () => {
    repo.findBlockerById.mockResolvedValue(openBlocker);
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
    const res = await svc.cancelBlocker('b1', {}, USER, 'EMPLOYEE', new Date('2026-11-06T08:00:00.000Z'));
    expect(res.status).toBe('CANCELLED');
    expect(res.isCredited).toBe(false);
  });

  it('المدير يرفض بلاغاً غير صحيح بسبب مكتوب، فيُلغى أثره ويُبلَّغ المنسق', async () => {
    repo.findBlockerById.mockResolvedValue(openBlocker);
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
    const res = await svc.cancelBlocker('b1', { note: 'لا عائق — ارفع المستحقات' }, MANAGER, 'MANAGER');
    expect(res.status).toBe('CANCELLED');
    expect(res.isCredited).toBe(false);
    expect(res.decidedById).toBe('m1');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      'u1', 'BLOCKER_REJECTED', expect.any(String), expect.stringContaining('ارفع المستحقات'), expect.any(Object),
    );
  });

  it('رفض البلاغ بلا سبب مرفوض', async () => {
    repo.findBlockerById.mockResolvedValue(openBlocker);
    await expect(svc.cancelBlocker('b1', {}, MANAGER, 'MANAGER')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('مشرف مشروع الدورة يرفض البلاغ، ومشرف مشروع آخر لا يستطيع', async () => {
    repo.findBlockerById.mockResolvedValue({ ...openBlocker, course: { id: 'c1', name: 'دورة', operationalProjectId: 'p1' } });
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
    await expect(svc.cancelBlocker('b1', { note: 'غير صحيح' }, { id: 's1' }, 'PROJECT_SUPERVISOR')).resolves.toBeDefined();
    permissions.canDecideElement.mockResolvedValue(false);
    await expect(svc.cancelBlocker('b1', { note: 'غير صحيح' }, { id: 's2' }, 'PROJECT_SUPERVISOR')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('قرار المدير على ما تجاوز السقف', () => {
  const pending = {
    id: 'b1',
    raisedById: 'u1',
    courseId: 'c1',
    status: 'OPEN',
    credit: 'QUOTA_EXCEEDED_PENDING',
    raisedAt: new Date('2026-11-04T08:00:00.000Z'),
    tracking: { element: { name: 'إصدار الشهادات' } },
    course: { name: 'دورة تجريبية' },
  };

  beforeEach(() => {
    repo.updateBlocker.mockImplementation(async (id, data) => ({ id, ...data }));
  });

  it('القبول يُفعّل الاحتساب', async () => {
    repo.findBlockerById.mockResolvedValue(pending);
    const res = await svc.decideBlocker('b1', { approve: true }, MANAGER, 'MANAGER');
    expect(res.isCredited).toBe(true);
    expect(res.credit).toBe('MANAGER_APPROVED');
  });

  it('الرفض يُبقي العقوبة', async () => {
    repo.findBlockerById.mockResolvedValue(pending);
    const res = await svc.decideBlocker('b1', { approve: false, note: 'البلاغ غير مبرَّر' }, MANAGER, 'MANAGER');
    expect(res.isCredited).toBe(false);
    expect(res.credit).toBe('MANAGER_REJECTED');
  });

  it('يُشعر المنسق بالقرار', async () => {
    repo.findBlockerById.mockResolvedValue(pending);
    await svc.decideBlocker('b1', { approve: false, note: 'غير مبرَّر' }, MANAGER, 'MANAGER');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      'u1', 'BLOCKER_REJECTED', expect.any(String), expect.stringContaining('غير مبرَّر'), expect.any(Object),
    );
  });

  it('لا يبتّ في بلاغ يسري تلقائياً', async () => {
    repo.findBlockerById.mockResolvedValue({ ...pending, credit: 'AUTO_APPROVED' });
    await expect(
      svc.decideBlocker('b1', { approve: true }, MANAGER, 'MANAGER'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
