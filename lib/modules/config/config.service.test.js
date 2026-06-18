import { describe, it, expect, vi, beforeEach } from 'vitest';
// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./config.service');
const repo = require('./config.repo');
const audit = require('../../services/audit');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع وسجل التدقيق.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = [
  'findTranslationKeys',
  'findAllTranslations',
  'upsertTranslations',
  'findOptions',
  'findAllOptions',
  'createOption',
  'updateOption',
  'deleteOption',
  'findAllSettings',
  'findSetting',
  'upsertSettings',
];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
});

const MANAGER = { userId: 'mgr-1', activeRole: 'MANAGER' };
const EMPLOYEE = { userId: 'emp-1', activeRole: 'EMPLOYEE' };

describe('config.service', () => {
  describe('getTranslationsNested', () => {
    it('builds nested { ar, en } dictionaries from dotted keys', async () => {
      repo.findTranslationKeys.mockResolvedValue([
        { key: 'common.save', ar: 'حفظ', en: 'Save' },
        { key: 'common.cancel', ar: 'إلغاء', en: 'Cancel' },
        { key: 'auth.login', ar: 'دخول', en: 'Login' },
      ]);

      await expect(svc.getTranslationsNested()).resolves.toEqual({
        ar: { common: { save: 'حفظ', cancel: 'إلغاء' }, auth: { login: 'دخول' } },
        en: { common: { save: 'Save', cancel: 'Cancel' }, auth: { login: 'Login' } },
      });
    });
  });

  describe('createOption', () => {
    it('lets a MANAGER create an option', async () => {
      repo.createOption.mockResolvedValue({ id: 'o1', value: 'RIYADH' });
      const dto = { category: 'CITY', value: 'RIYADH', labelAr: 'الرياض', labelEn: 'Riyadh' };
      const result = await svc.createOption(dto, MANAGER);

      expect(repo.createOption).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'o1', value: 'RIYADH' });
    });

    it('forbids a non-manager (403) and never touches the repo', async () => {
      const dto = { category: 'CITY', value: 'X', labelAr: 'س', labelEn: 'X' };
      await expect(svc.createOption(dto, EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.createOption).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpsertSettings', () => {
    it('calls the repo for a MANAGER', async () => {
      const entries = [{ key: 'report.email.to', value: 'OD@NAUSS.EDU.SA' }];
      repo.upsertSettings.mockResolvedValue([{ key: 'report.email.to' }]);
      await svc.bulkUpsertSettings(entries, MANAGER);
      expect(repo.upsertSettings).toHaveBeenCalledWith(entries);
    });

    it('forbids a non-manager (403) and never touches the repo', async () => {
      await expect(svc.bulkUpsertSettings([{ key: 'k', value: 'v' }], EMPLOYEE)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.upsertSettings).not.toHaveBeenCalled();
    });
  });
});
