import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = require('./certReview.service');
const repo = require('../closure/closure.repo');
const permissions = require('../../services/permissions');
const notifications = require('../../services/notifications');
const prisma = require('../../db/prisma');

const COORD = { id: 'u-coord', firstName: 'منسق', lastName: 'الدورة' };
const PEER = { id: 'u-peer', firstName: 'زميل', lastName: 'مراجع', isActive: true, roles: ['EMPLOYEE'] };
const course = { id: 'c1', name: 'دورة', primaryEmployeeId: COORD.id };
const item = (formData = null, status = 'NOT_STARTED') => ({ id: 't1', status, formData, element: { key: 'certificates' }, course, courseId: course.id });

let saved;
beforeEach(() => {
  vi.restoreAllMocks();
  saved = null;
  vi.spyOn(permissions, 'canSubmitElement').mockImplementation(async (u) => u.id === COORD.id);
  vi.spyOn(permissions, 'canViewCourse').mockResolvedValue(true);
  vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(PEER);
  vi.spyOn(prisma.courseClosureTracking, 'update').mockImplementation(async ({ data }) => { saved = data.formData; return {}; });
});

describe('مراجعة الشهادات بعين ثانية', () => {
  it('لا تُعدّ مكتملة إلا بتأكيد المراجِع', () => {
    expect(svc.isConfirmed(null)).toBe(false);
    expect(svc.isConfirmed({ certReview: { status: 'ASSIGNED' } })).toBe(false);
    expect(svc.isConfirmed({ certReview: { status: 'RETURNED', respondedAt: 'x' } })).toBe(false);
    expect(svc.isConfirmed({ certReview: { status: 'CONFIRMED', respondedAt: '2026-11-16' } })).toBe(true);
  });

  it('يُسند المنسق المراجعة لزميل فيُشعَر الزميل', async () => {
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item());
    const { review } = await svc.assign('t1', { reviewerId: PEER.id, link: 'https://drive.example/certs' }, COORD, 'EMPLOYEE');
    expect(review).toMatchObject({ status: 'ASSIGNED', reviewerId: PEER.id, reviewerName: 'زميل مراجع', rounds: 1 });
    expect(saved.certReview.reviewerId).toBe(PEER.id);
    expect(notifications.createNotification).toHaveBeenCalledWith(PEER.id, 'CERT_REVIEW', expect.stringContaining('مراجعة شهادات'), expect.any(String), expect.any(Object));
  });

  it('لا يراجع المنسق شهادات دورته بنفسه', async () => {
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item());
    await expect(svc.assign('t1', { reviewerId: COORD.id }, COORD, 'EMPLOYEE')).rejects.toThrow(/منسق آخر/);
  });

  it('لا تُسند لمستخدم غير نشط أو ليس منسقاً', async () => {
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item());
    prisma.user.findUnique.mockResolvedValue({ ...PEER, isActive: false });
    await expect(svc.assign('t1', { reviewerId: PEER.id }, COORD, 'EMPLOYEE')).rejects.toThrow(/منسقاً نشطاً/);
  });

  it('لا تُسند بعد تقديم العنصر', async () => {
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item(null, 'PENDING_APPROVAL'));
    await expect(svc.assign('t1', { reviewerId: PEER.id }, COORD, 'EMPLOYEE')).rejects.toThrow(/مُقدَّم/);
  });

  it('المراجِع المسند وحده يؤكد، ويُشعَر المنسق', async () => {
    const assigned = { certReview: { status: 'ASSIGNED', reviewerId: PEER.id, reviewerName: 'زميل مراجع', assignedById: COORD.id } };
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item(assigned));
    await expect(svc.respond('t1', { decision: 'confirm' }, COORD)).rejects.toThrow(/لست المراجِع/);
    const { review } = await svc.respond('t1', { decision: 'confirm' }, PEER);
    expect(review.status).toBe('CONFIRMED');
    expect(svc.isConfirmed(saved)).toBe(true);
    expect(notifications.createNotification).toHaveBeenCalledWith(COORD.id, 'CERT_REVIEW', expect.stringContaining('رُوجعت'), expect.any(String), expect.any(Object));
  });

  it('الإعادة تتطلب ملاحظات، وبعدها يعيد المنسق الإرسال', async () => {
    const assigned = { certReview: { status: 'ASSIGNED', reviewerId: PEER.id, reviewerName: 'زميل مراجع', assignedById: COORD.id, rounds: 1 } };
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item(assigned));
    await expect(svc.respond('t1', { decision: 'return', note: '' }, PEER)).rejects.toThrow(/الملاحظات/);
    const { review } = await svc.respond('t1', { decision: 'return', note: 'اسم متدرب خاطئ' }, PEER);
    expect(review).toMatchObject({ status: 'RETURNED', reviewerNote: 'اسم متدرب خاطئ' });
    repo.findTrackingWithElementAndCourse.mockResolvedValue(item(saved));
    const again = await svc.assign('t1', { reviewerId: PEER.id }, COORD, 'EMPLOYEE');
    expect(again.review).toMatchObject({ status: 'ASSIGNED', rounds: 2 });
  });
});
