import { describe, it, expect, vi, beforeEach } from 'vitest';
// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./projects.service');
const repo = require('./projects.repo');
const audit = require('../../services/audit');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع وسجل التدقيق.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = ['findAll', 'findAllMinimal', 'findById', 'findWithRelationCounts', 'create', 'update', 'remove'];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
});

const MANAGER = { userId: 'mgr-1', activeRole: 'MANAGER' };
const EMPLOYEE = { userId: 'emp-1', activeRole: 'EMPLOYEE' };

describe('projects.service', () => {
  describe('getById', () => {
    it('returns the project when found', async () => {
      repo.findById.mockResolvedValue({ id: 'p1', name: 'مشروع' });
      await expect(svc.getById('p1')).resolves.toEqual({ id: 'p1', name: 'مشروع' });
    });

    it('throws 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.getById('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('create', () => {
    it('lets a MANAGER create a project and writes an audit entry', async () => {
      repo.create.mockResolvedValue({ id: 'p2', name: 'جديد' });
      const result = await svc.create({ name: 'جديد' }, MANAGER);

      expect(repo.create).toHaveBeenCalledWith('جديد');
      expect(audit.logAudit).toHaveBeenCalledWith('mgr-1', 'MANAGER', 'PROJECT_CREATED', expect.objectContaining({ projectId: 'p2' }));
      expect(result).toEqual({ id: 'p2', name: 'جديد' });
    });

    it('forbids a non-manager (403) and never touches the repo', async () => {
      await expect(svc.create({ name: 'x' }, EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.logAudit).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an empty project', async () => {
      repo.findWithRelationCounts.mockResolvedValue({ id: 'p3', name: 'فارغ', _count: { users: 0, courses: 0, supervisors: 0 } });
      await expect(svc.remove('p3', MANAGER)).resolves.toEqual({ success: true });
      expect(repo.remove).toHaveBeenCalledWith('p3');
    });

    it('refuses to delete a project that has relations (400) and never deletes', async () => {
      repo.findWithRelationCounts.mockResolvedValue({ id: 'p4', name: 'مرتبط', _count: { users: 3, courses: 0, supervisors: 0 } });
      await expect(svc.remove('p4', MANAGER)).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('forbids a non-manager (403)', async () => {
      await expect(svc.remove('p1', EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.findWithRelationCounts).not.toHaveBeenCalled();
    });
  });

  describe('list / publicList', () => {
    it('list delegates to repo.findAll', async () => {
      repo.findAll.mockResolvedValue([{ id: 'p1' }]);
      await expect(svc.list()).resolves.toEqual([{ id: 'p1' }]);
    });
    it('publicList delegates to repo.findAllMinimal', async () => {
      repo.findAllMinimal.mockResolvedValue([{ id: 'p1', name: 'م' }]);
      await expect(svc.publicList()).resolves.toEqual([{ id: 'p1', name: 'م' }]);
    });
  });
});
