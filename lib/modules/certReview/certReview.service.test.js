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
    // بلا مرفق ولا رابط لا يُرسل — المراجع يحتاج ما يراجعه
    await expect(svc.assign('t1', { reviewerId: PEER.id }, COORD, 'EMPLOYEE')).rejects.toThrow(/أرفق الشهادات/);
    repo.findTrackingWithElementAndCourse.mockResolvedValue(item({ ...saved, certFiles: [{ key: 'certrev/aaaaaaaaaaaa.pdf', name: 'شهادات.pdf', size: 10, type: 'application/pdf' }] }));
    const again = await svc.assign('t1', { reviewerId: PEER.id }, COORD, 'EMPLOYEE');
    expect(again.review).toMatchObject({ status: 'ASSIGNED', rounds: 2 });
    expect(again.review.history.map((h) => h.type)).toEqual(['returned', 'assigned']);
  });

  it('تأكيد المراجعة يحذف الشهادات المرفقة من المخزن', async () => {
    const store = require('../../storage/mediaStore');
    const removed = [];
    vi.spyOn(store, 'remove').mockImplementation(async (k) => { removed.push(k); });
    const assigned = { certReview: { status: 'ASSIGNED', reviewerId: PEER.id, reviewerName: 'زميل مراجع', assignedById: COORD.id, assignedAt: new Date(Date.now() - 5 * 36e5).toISOString(), rounds: 1 },
      certFiles: [{ key: 'certrev/aaaaaaaaaaaa.pdf' }, { key: 'certrev/bbbbbbbbbbbb.png' }] };
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item(assigned));
    const { review } = await svc.respond('t1', { decision: 'confirm' }, PEER);
    expect(removed).toEqual(['certrev/aaaaaaaaaaaa.pdf', 'certrev/bbbbbbbbbbbb.png']);
    expect(saved.certFiles).toEqual([]);
    expect(review.history.at(-1)).toMatchObject({ type: 'confirmed', filesDeleted: 2 });
    expect(review.history.at(-1).hours).toBeCloseTo(5, 0);
  });

  it('المرفق PDF أو صورة فقط، ولمنسق الدورة', async () => {
    vi.spyOn(repo, 'findTrackingWithElementAndCourse').mockResolvedValue(item());
    await expect(svc.addFile('t1', { name: 'x.exe', dataUrl: 'data:application/x-msdownload;base64,AAAA' }, COORD, 'EMPLOYEE')).rejects.toThrow(/PDF/);
    await expect(svc.addFile('t1', { name: 'x.pdf', dataUrl: 'data:application/pdf;base64,AAAA' }, PEER, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('لوحة المراجعات', () => {
  const H = (h) => new Date(Date.parse('2026-11-10T08:00:00Z') + h * 36e5).toISOString();
  const items = [
    { courseId: 'c1', courseName: 'أ', coordinator: 'منسق ١', review: { status: 'CONFIRMED', history: [
      { type: 'assigned', at: H(0), reviewerId: 'r1', reviewerName: 'مراجع ١', round: 1 },
      { type: 'returned', at: H(10), reviewerId: 'r1', note: 'اسم خاطئ', round: 1 },
      { type: 'assigned', at: H(20), reviewerId: 'r1', reviewerName: 'مراجع ١', round: 2 },
      { type: 'confirmed', at: H(22), reviewerId: 'r1', round: 2 },
    ] } },
    { courseId: 'c2', courseName: 'ب', coordinator: 'منسق ٢', review: { status: 'CONFIRMED', reviewerId: 'r2', reviewerName: 'مراجع ٢', assignedAt: H(0), respondedAt: H(30), rounds: 1 } },
    { courseId: 'c3', courseName: 'ج', coordinator: 'منسق ٣', review: { status: 'ASSIGNED', reviewerId: 'r2', reviewerName: 'مراجع ٢', assignedAt: H(0), rounds: 1 } },
  ];

  it('الجولات والوقت والنتائج والمنتظر', () => {
    const s = svc.summarizeReviews(items, new Date(H(48)));
    expect(s.totals).toMatchObject({ reviews: 3, confirmed: 2, returned: 1, pending: 1, courses: 3, firstPassShare: 50 });
    expect(s.totals.avgHours).toBe(14); // (10 + 2 + 30) / 3
    expect(s.reviewers[0]).toMatchObject({ name: 'مراجع ١', reviews: 2, returned: 1, avgHours: 6 });
    expect(s.pending[0]).toMatchObject({ courseName: 'ج', waitingHours: 48 });
    expect(s.notes[0]).toMatchObject({ note: 'اسم خاطئ', decision: 'returned' });
  });
});
