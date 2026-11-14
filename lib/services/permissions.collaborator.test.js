import { describe, it, expect, vi, beforeEach } from 'vitest';

// المنسق المتعاون: لا ينتمي لمشروع ومرجعه المدير، ويسند المدير متابعته لمشرف
const prisma = require('../db/prisma');
const permissions = require('./permissions');

const SUP = { id: 'sup1' };
const COURSE = { id: 'c1', operationalProjectId: 'p1', primaryEmployeeId: 'collab' };

beforeEach(() => {
  vi.restoreAllMocks();
  // مشرف sup1 يشرف على المشروع p1
  vi.spyOn(prisma.projectSupervisor, 'findFirst').mockImplementation(async ({ where }) =>
    (where.userId === 'sup1' && where.operationalProjectId === 'p1' ? { id: 'ps' } : null));
});

describe('المنسق المتعاون', () => {
  it('دوراته لا يعتمدها مشرف مشروع الدورة', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ isCollaborator: true, followUpSupervisorId: null });
    await expect(permissions.canDecideElement(SUP, 'PROJECT_SUPERVISOR', COURSE)).resolves.toBe(false);
  });

  it('بل المشرف الذي أسند إليه المدير متابعته', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ isCollaborator: true, followUpSupervisorId: 'sup2' });
    await expect(permissions.canDecideElement({ id: 'sup2' }, 'PROJECT_SUPERVISOR', COURSE)).resolves.toBe(true);
  });

  it('والمدير يعتمدها دائماً', async () => {
    await expect(permissions.canDecideElement({ id: 'm' }, 'MANAGER', COURSE)).resolves.toBe(true);
  });

  it('ودورات الموظف الفعلي يعتمدها مشرف مشروعها كما كان', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ isCollaborator: false, followUpSupervisorId: null });
    await expect(permissions.canDecideElement(SUP, 'PROJECT_SUPERVISOR', COURSE)).resolves.toBe(true);
  });

  it('المشرف المتابع يرى المتعاون في قائمة مستخدميه', async () => {
    await expect(permissions.supervisesUser('sup2', { isCollaborator: true, followUpSupervisorId: 'sup2' })).resolves.toBe(true);
    await expect(permissions.supervisesUser('sup1', { isCollaborator: true, followUpSupervisorId: 'sup2', operationalProjectId: null })).resolves.toBe(false);
  });
});
