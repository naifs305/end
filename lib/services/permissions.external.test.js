import { describe, it, expect, vi, beforeEach } from 'vitest';

// الدورة الخارجية: تُنسب لمشروعها، لكن يراجع عناصرها مشرف مشروع منسّقها.
// مثال: منسق من مشروع «بشاير» كُلّف بدورة خارجية تتبع مشروع «خازم»
// فيراجعه مشرف «بشاير» لا مشرف «خازم».
const prisma = require('../db/prisma');
const permissions = require('./permissions');

const SUPERVISORS = { bushair: 'pB', khazem: 'pK' };
const EXTERNAL = { id: 'c1', courseType: 'external', operationalProjectId: 'pK', primaryEmployeeId: 'fouad' };
const FOUAD = { isCollaborator: false, followUpSupervisorId: null, operationalProjectId: 'pB' };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(prisma.projectSupervisor, 'findFirst').mockImplementation(async ({ where }) =>
    (SUPERVISORS[where.userId] === where.operationalProjectId ? { id: 'ps' } : null));
  vi.spyOn(prisma.projectSupervisor, 'findMany').mockImplementation(async ({ where }) =>
    Object.entries(SUPERVISORS).filter(([, p]) => p === where.operationalProjectId).map(([userId]) => ({ userId })));
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(FOUAD);
});

describe('الدورة الخارجية', () => {
  it('يعتمد عناصرها مشرف مشروع المنسق', async () => {
    await expect(permissions.canDecideElement({ id: 'bushair' }, 'PROJECT_SUPERVISOR', EXTERNAL)).resolves.toBe(true);
  });

  it('لا مشرف مشروع الدورة', async () => {
    await expect(permissions.canDecideElement({ id: 'khazem' }, 'PROJECT_SUPERVISOR', EXTERNAL)).resolves.toBe(false);
  });

  it('والتذكير والتنبيهات تذهب لمشرف المنسق', async () => {
    await expect(permissions.findCourseSupervisorIds(EXTERNAL)).resolves.toEqual(['bushair']);
  });

  it('والدورة الداخلية تبقى لمشرف مشروعها', async () => {
    const internal = { ...EXTERNAL, courseType: 'internal' };
    await expect(permissions.canDecideElement({ id: 'khazem' }, 'PROJECT_SUPERVISOR', internal)).resolves.toBe(true);
    await expect(permissions.canDecideElement({ id: 'bushair' }, 'PROJECT_SUPERVISOR', internal)).resolves.toBe(false);
  });

  it('والمنسق بلا مشروع: تبقى الخارجية لمشرف مشروع الدورة', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...FOUAD, operationalProjectId: null });
    await expect(permissions.findCourseSupervisorIds(EXTERNAL)).resolves.toEqual(['khazem']);
  });

  it('وقائمة دورات المشرف تشمل خارجية منسقيه', async () => {
    vi.spyOn(prisma.projectSupervisor, 'findMany').mockResolvedValue([{ operationalProjectId: 'pB' }]);
    const where = await permissions.buildCoursesWhere({ id: 'bushair' }, 'PROJECT_SUPERVISOR');
    expect(where.OR).toContainEqual({ courseType: 'external', primaryEmployee: { isCollaborator: false, operationalProjectId: { in: ['pB'] } } });
    expect(where.OR).toContainEqual({ courseType: { not: 'external' }, operationalProjectId: { in: ['pB'] }, primaryEmployee: { isCollaborator: false } });
  });
});
