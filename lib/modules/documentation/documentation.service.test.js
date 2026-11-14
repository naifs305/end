import { describe, it, expect, vi, beforeEach } from 'vitest';

// require لا import: الخدمة تستعمل require، والتجسّس يرى كائنها نفسه
const svc = require('./documentation.service');
const repo = require('./documentation.repo');
const store = require('../../storage/mediaStore');
const mediaUrl = require('../../storage/mediaUrl');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const configService = require('../config/config.service');
const kpi = require('../kpi/kpi.service');

const COURSE = { id: 'c1', name: 'دورة', primaryEmployeeId: 'u1', operationalProjectId: 'p1', primaryEmployee: { id: 'u1' } };
const ACTOR = { user: { id: 'u1' }, activeRole: 'EMPLOYEE' };
const CRIT = { minPhotos: 8, minIntroChars: 60 };
const photos = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, sortOrder: i, width: 100, height: 100, size: 1 }));
const DOC = (over = {}) => ({ id: 'd1', courseId: 'c1', status: 'DRAFT', media: photos(8), sessions: [], coverMediaId: 'm0', intro: 'م'.repeat(80), ...over });

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of ['findCourse', 'findByCourse', 'ensure', 'update', 'findMedia', 'nextSortOrder', 'countMedia', 'createMedia', 'updateMedia', 'deleteMedia', 'reorderMedia', 'replaceSessions']) {
    vi.spyOn(repo, m).mockResolvedValue(undefined);
  }
  repo.findCourse.mockResolvedValue(COURSE);
  vi.spyOn(permissions, 'canViewCourse').mockResolvedValue(true);
  vi.spyOn(permissions, 'canSubmitElement').mockResolvedValue(true);
  vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(false);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
  vi.spyOn(configService, 'getSetting').mockImplementation(async (_k, d) => d);
  vi.spyOn(store, 'save').mockResolvedValue('k');
});

describe('توثيق الدورة — عنصر تميّز اختياري', () => {
  it('النجمة بمعايير ظاهرة: عدد الصور، والغلاف، والمقدمة', () => {
    expect(svc.evaluate(DOC(), CRIT).ready).toBe(true);
    expect(svc.evaluate(DOC({ media: photos(7) }), CRIT).ready).toBe(false);
    expect(svc.evaluate(DOC({ coverMediaId: null }), CRIT).ready).toBe(false);
    expect(svc.evaluate(DOC({ intro: 'قصيرة' }), CRIT).ready).toBe(false);
    // الغلاف يجب أن يكون من صور التوثيق نفسه
    expect(svc.evaluate(DOC({ coverMediaId: 'غريبة' }), CRIT).ready).toBe(false);
  });

  it('لا يُنشر قبل استكمال المعايير، ويُقال ما ينقص', async () => {
    repo.findByCourse.mockResolvedValue(DOC({ media: photos(3) }));
    await expect(svc.publish('c1', ACTOR)).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('صور على الأقل') });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('النشر بالمعايير يمنح النجمة تلقائياً — بلا انتظار اعتماد مشرف', async () => {
    repo.findByCourse.mockResolvedValue(DOC());
    await svc.publish('c1', ACTOR);
    expect(repo.update).toHaveBeenCalledWith('d1', expect.objectContaining({ status: 'PUBLISHED', starAwarded: true, slug: expect.any(String) }));
  });

  it('إلغاء النشر يُسقط النجمة ويُبقي الرابط', async () => {
    repo.findByCourse.mockResolvedValue(DOC({ status: 'PUBLISHED', slug: 'abc', starAwarded: true }));
    await svc.unpublish('c1', ACTOR);
    expect(repo.update).toHaveBeenCalledWith('d1', { status: 'DRAFT', starAwarded: false });
  });

  it('توثيق منشور نقص بعد التعديل عن المعايير تسقط نجمته حتى يُستكمل', async () => {
    repo.ensure.mockResolvedValue(DOC({ status: 'PUBLISHED', starAwarded: true }));
    repo.findByCourse.mockResolvedValue(DOC({ status: 'PUBLISHED', starAwarded: true, intro: 'قصيرة' }));
    await svc.updateContent('c1', { intro: 'قصيرة' }, ACTOR);
    expect(repo.update).toHaveBeenCalledWith('d1', { starAwarded: false });
  });

  it('التوثيق لمن يعمل على الدورة أو يشرف عليها، لا لغيرهما', async () => {
    permissions.canSubmitElement.mockResolvedValue(false);
    await expect(svc.publish('c1', ACTOR)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('لا تُقبل صورة بغير صيغ الصور', async () => {
    repo.ensure.mockResolvedValue(DOC());
    repo.countMedia.mockResolvedValue(0);
    await expect(svc.addMedia('c1', { full: 'data:text/html;base64,PGI+', thumb: 'x', width: 800, height: 600 }, ACTOR))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('أول صورة تصير الغلاف حتى يختار المنسق غيرها', async () => {
    repo.ensure.mockResolvedValue(DOC({ coverMediaId: null, media: [] }));
    repo.countMedia.mockResolvedValue(0);
    repo.nextSortOrder.mockResolvedValue(0);
    repo.createMedia.mockResolvedValue({ id: 'new', sortOrder: 0, width: 800, height: 600, size: 3 });
    const img = 'data:image/webp;base64,UklGRg==';
    await svc.addMedia('c1', { full: img, thumb: img, width: 800, height: 600 }, ACTOR);
    expect(repo.update).toHaveBeenCalledWith('d1', { coverMediaId: 'new' });
  });
});

describe('روابط الصور', () => {
  it('صورة التوثيق غير المنشور لا تُعرض إلا برابط موقَّع صالح', async () => {
    repo.findMedia.mockResolvedValue({ id: 'm1', fileKey: 'c1/aaaaaaaaaa.webp', thumbKey: 'c1/bbbbbbbbbb.webp', documentation: { status: 'DRAFT' } });
    await expect(svc.mediaForDisplay('m1', 'thumb', {})).rejects.toMatchObject({ statusCode: 403 });
    const url = new URL(`http://x${mediaUrl.signedUrl('m1', 'thumb')}`);
    const q = Object.fromEntries(url.searchParams);
    await expect(svc.mediaForDisplay('m1', 'thumb', q)).resolves.toMatchObject({ key: 'c1/bbbbbbbbbb.webp' });
  });

  it('وصورة التوثيق المنشور عامة لمن يملك الرابط', async () => {
    repo.findMedia.mockResolvedValue({ id: 'm1', fileKey: 'c1/aaaaaaaaaa.webp', thumbKey: 'c1/bbbbbbbbbb.webp', documentation: { status: 'PUBLISHED' } });
    await expect(svc.mediaForDisplay('m1', 'full', {})).resolves.toMatchObject({ key: 'c1/aaaaaaaaaa.webp', published: true });
  });

  it('المخزن لا يقبل مفتاحاً يخرج عن مجلده', () => {
    expect(() => store.assertKey('../../etc/passwd')).toThrow();
    expect(() => store.assertKey('c1/../../x.webp')).toThrow();
    expect(() => store.assertKey('c1/abcdef123456.webp')).not.toThrow();
  });
});

describe('المؤشرات — إضافة للمتميّزين بلا خصم', () => {
  it('+3 لكل دورة وُثّقت بنجمة، حد أقصى +6', () => {
    const c = (star) => ({ documentation: star === null ? null : { starAwarded: star } });
    expect(kpi.excellenceBonusFor([c(true)])).toBe(3);
    expect(kpi.excellenceBonusFor([c(true), c(true), c(true)])).toBe(6);
  });

  it('من لم يوثّق مكافأته صفر — لا خصم أبداً', () => {
    expect(kpi.excellenceBonusFor([])).toBe(0);
    expect(kpi.excellenceBonusFor([{ documentation: null }, { documentation: { starAwarded: false } }])).toBe(0);
  });
});

describe('المجلة العامة والتقرير الفني', () => {
  it('المجلة العامة لا تحمل المتدربين ولا درجاتهم', async () => {
    vi.spyOn(repo, 'findBySlug').mockResolvedValue({
      ...DOC({ status: 'PUBLISHED', slug: 'abcdefghij12' }),
      trainees: [{ id: 't1', name: 'متدرب', score: 95 }],
      reportSummary: 'سرّي', recommendations: 'سرّي',
      course: COURSE,
    });
    vi.spyOn(repo, 'incrementViews').mockResolvedValue(null);
    const out = await svc.getPublic('abcdefghij12');
    expect(out.documentation).not.toHaveProperty('trainees');
    expect(out.documentation).not.toHaveProperty('reportSummary');
    expect(JSON.stringify(out)).not.toContain('سرّي');
  });

  it('لا تُعرض مجلة غير منشورة، ولا رابط بصيغة غريبة', async () => {
    vi.spyOn(repo, 'findBySlug').mockResolvedValue({ ...DOC({ status: 'DRAFT', slug: 'abcdefghij12' }), course: COURSE });
    await expect(svc.getPublic('abcdefghij12')).resolves.toBeNull();
    await expect(svc.getPublic('../etc')).resolves.toBeNull();
  });

  it('بيانات المتدربين تُنظَّف: الدرجة بين ٠ و١٠٠ وتقبل الأرقام العربية، والمفتاح الغريب يُسقط', () => {
    const out = svc.cleanTrainees([
      { name: ' أحمد ', score: '٩٥', photoKey: 'c1-t/abcdef123456.jpg' },
      { name: 'سالم', score: 140, photoKey: '../../x' },
      { name: '', score: 50 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'أحمد', score: 95, photoKey: 'c1-t/abcdef123456.jpg' });
    expect(out[1]).toMatchObject({ score: 100, photoKey: null });
  });

  it('المجلات الصادرة حديثاً تظهر في شريط الأخبار برابطها', async () => {
    vi.spyOn(repo, 'findRecentPublished').mockResolvedValue([{ slug: 'abcdefghij12', course: { name: 'إدارة الحشود', primaryEmployee: { firstName: 'خالد', lastName: 'س' } } }]);
    const items = await svc.tickerItems();
    expect(items[0].href).toBe('/m/abcdefghij12');
    expect(items[0].text).toContain('إدارة الحشود');
  });
});
