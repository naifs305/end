import { describe, it, expect, vi, beforeEach } from 'vitest';

// require لا import: الخدمة تستعمل require، والتجسّس يرى كائنها نفسه
const svc = require('./interpreters.service');
const repo = require('./interpreters.repo');
const audit = require('../../services/audit');

const VALID = {
  fullName: 'سالم بن أحمد العلي', nationalId: '1000000001', nationality: 'سعودي',
  email: 'x@example.com', mobile: '0500000000', address: 'المملكة العربية السعودية',
};

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of ['findAll', 'findById', 'findByNationalId', 'create', 'update', 'remove']) {
    vi.spyOn(repo, m).mockResolvedValue(undefined);
  }
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
});

describe('سجل المترجمين', () => {
  it('يحفظ الثابت وحده: المبلغ يتغيّر مع كل تعاقد فلا مكان له في السجل', () => {
    const data = svc.validateProfile({ ...VALID, amount: 12000, specialty: 'ترجمة فورية' });
    expect(data).not.toHaveProperty('amount');
    expect(data.specialty).toBe('ترجمة فورية');
  });

  it('الإضافة والتعديل والحذف للمدير وحده', async () => {
    const coordinator = { userId: 'u1', activeRole: 'EMPLOYEE' };
    await expect(svc.create(VALID, coordinator)).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.update('i1', VALID, coordinator)).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.remove('i1', coordinator)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('المنسق يرى السجل ليختار منه، والجودة لا ترى الهويات والحسابات', async () => {
    repo.findAll.mockResolvedValue([]);
    await expect(svc.list('', { activeRole: 'EMPLOYEE' })).resolves.toEqual([]);
    await expect(svc.list('', { activeRole: 'QUALITY_VIEWER' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('لا يتكرر مترجم بالهوية نفسها', async () => {
    repo.findByNationalId.mockResolvedValue({ id: 'i1' });
    await expect(svc.create(VALID, { userId: 'm', activeRole: 'MANAGER' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('مترجم جديد يسجّله منسق في دورة يدخل السجل تلقائياً', async () => {
    repo.findByNationalId.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 'new' });
    await expect(svc.syncFromCourse(VALID, 'u1')).resolves.toBe('new');
    expect(repo.create).toHaveBeenCalled();
  });

  it('إدخال المنسق لا يكتب فوق ما في السجل، بل يكمّل الخانات الفارغة فقط', async () => {
    repo.findByNationalId.mockResolvedValue({ id: 'i1', ...VALID, email: 'old@example.com', iban: null });
    await svc.syncFromCourse({ ...VALID, email: 'typo@example.com', iban: 'SA0000000000000000000001' }, 'u1');
    expect(repo.update).toHaveBeenCalledWith('i1', { iban: 'SA0000000000000000000001' });
  });

  it('الاستيراد يحدّث الموجود ويضيف الجديد، وما لا يصح يُذكر ولا يوقف البقية', async () => {
    repo.findByNationalId.mockImplementation(async (nid) => (nid === '1000000001' ? { id: 'i1' } : null));
    const r = await svc.importMany(
      [VALID, { ...VALID, nationalId: '1000000002' }, { fullName: 'ناقص' }],
      { userId: 'm', activeRole: 'MANAGER' },
    );
    expect(r.updated).toBe(1);
    expect(r.added).toBe(1);
    expect(r.failed).toHaveLength(1);
  });
});
