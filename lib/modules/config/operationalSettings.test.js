import { describe, it, expect } from 'vitest';

const os = require('./operationalSettings');

const field = (key) => os.ALL_SETTING_FIELDS.find((f) => f.key === key);

const COMPLETE = {
  'blockers.quarterQuota': '3',
  'blockers.partyDirectory': 'تطوير الأعمال = bd@nauss.edu.sa',
  'course.entryLeadHours': '72',
  'interpreter.transfer.email.to': 'AAlfaifi@nauss.edu.sa',
  'interpreter.legal.email.to': 'Legal@nauss.edu.sa',
  'interpreter.legal.email.cc': 'NAlshahrani@nauss.edu.sa',
  'interpreter.finance.email.to': 'finance@nauss.edu.sa',
  'interpreter.finance.email.cc': 'AAlaraj@nauss.edu.sa, SAlbayoumi@nauss.edu.sa',
  'interpreter.contract.rep': 'عبد الرزاق عبد العزيز المرجان',
  'interpreter.contract.repTitle': 'وكيل الجامعة للتدريب',
  'interpreter.contract.email': 't-aalmargan@nauss.edu.sa',
  'interpreter.contract.bufferDays': '2',
  'report.email.to': 'OD@NAUSS.EDU.SA',
  'report.email.cc': 'NALSHAHRANI@NAUSS.EDU.SA',
  'trainer.hr.email.to': 'hr@nauss.edu.sa',
  'trainer.hr.email.cc': 'od@nauss.edu.sa',
  'trainer.protocol.email.to': 'PRM@nauss.edu.sa',
  'trainer.protocol.email.cc': 'od@nauss.edu.sa',
  'trainer.hospitality.email.to': 'Hospitality@nauss.edu.sa',
  'trainer.hospitality.email.cc': 'od@nauss.edu.sa',
  'travelGuide.request.email.to': 'od@nauss.edu.sa',
  'travelGuide.request.email.cc': 'od@nauss.edu.sa',
};

describe('تعريف إعدادات التشغيل', () => {
  it('كل حقل له مفتاح وتصنيف ووصف يُخزَّن معه', () => {
    for (const f of os.ALL_SETTING_FIELDS) {
      expect(f.key).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.settingLabel).toBeTruthy();
      expect(f.label).toBeTruthy();
    }
  });

  it('لا تكرار في المفاتيح', () => {
    const keys = os.ALL_SETTING_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('يغطي الإعدادات التي وعدنا بأنها تُغيَّر من المنصة', () => {
    const keys = os.ALL_SETTING_FIELDS.map((f) => f.key);
    for (const key of [
      'blockers.quarterQuota',
      'blockers.partyDirectory',
      'course.entryLeadHours',
      'interpreter.transfer.email.to',
      'interpreter.contract.rep',
      'interpreter.contract.bufferDays',
      'interpreter.legal.email.to',
      'interpreter.legal.email.cc',
      'interpreter.finance.email.to',
      'interpreter.finance.email.cc',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('قائمة العناوين تقبل عدة عناوين وترفض المكسور منها', () => {
    const cc = os.ALL_SETTING_FIELDS.find((f) => f.key === 'interpreter.finance.email.cc');
    expect(os.validateSettingField(cc, 'a@b.co, c@d.co, e@f.co')).toBe('');
    expect(os.validateSettingField(cc, 'a@b.co, ناقص')).toContain('ناقص');
  });
});

describe('التحقق من الأرقام', () => {
  const quota = () => field('blockers.quarterQuota');

  it('الرقم الصحيح الموجب يُقبل', () => {
    expect(os.validateSettingField(quota(), '3')).toBe('');
    expect(os.validateSettingField(quota(), '0')).toBe('');
  });

  it('الفارغ يُرفض — الرصيد لا يكون بلا قيمة', () => {
    expect(os.validateSettingField(quota(), '')).toBeTruthy();
  });

  it('السالب والكسر والنص تُرفض', () => {
    expect(os.validateSettingField(quota(), '-1')).toBeTruthy();
    expect(os.validateSettingField(quota(), '2.5')).toBeTruthy();
    expect(os.validateSettingField(quota(), 'ثلاثة')).toBeTruthy();
  });
});

describe('التحقق من البريد', () => {
  const to = () => field('report.email.to');

  it('البريد السليم يُقبل', () => {
    expect(os.validateSettingField(to(), 'od@nauss.edu.sa')).toBe('');
  });

  it('البريد المشوّه يُرفض', () => {
    expect(os.validateSettingField(to(), 'od@nauss')).toBeTruthy();
    expect(os.validateSettingField(to(), 'od nauss.edu.sa')).toBeTruthy();
    expect(os.validateSettingField(to(), '')).toBeTruthy();
  });
});

describe('التحقق من دليل الجهات', () => {
  const dir = () => field('blockers.partyDirectory');

  it('الفراغ مقبول — القائمة تبقى معطّلة حتى تُسجَّل العناوين', () => {
    expect(os.validateSettingField(dir(), '')).toBe('');
  });

  it('سطر سليم يُقبل', () => {
    expect(os.validateSettingField(dir(), 'تطوير الأعمال = bd@nauss.edu.sa')).toBe('');
  });

  it('عدة أسطر سليمة تُقبل', () => {
    const value = 'تطوير الأعمال = bd@nauss.edu.sa\nالمدربون = trainers@nauss.edu.sa';
    expect(os.validateSettingField(dir(), value)).toBe('');
  });

  it('سطر بلا بريد يُرفض ويُسمّى في الرسالة', () => {
    const message = os.validateSettingField(dir(), 'تطوير الأعمال');
    expect(message).toContain('تطوير الأعمال');
  });

  it('سطر ببريد مشوّه يُرفض — جهة لا يصلها بريد', () => {
    expect(os.validateSettingField(dir(), 'المدربون = trainers')).toBeTruthy();
  });

  it('سطر بلا اسم يُرفض', () => {
    expect(os.validateSettingField(dir(), ' = bd@nauss.edu.sa')).toBeTruthy();
  });

  it('الأسطر الفارغة بين السليمة لا تُعدّ خطأ', () => {
    const value = 'تطوير الأعمال = bd@nauss.edu.sa\n\n\nالمدربون = trainers@nauss.edu.sa';
    expect(os.validateSettingField(dir(), value)).toBe('');
  });
});

describe('التحقق الشامل والحمولة', () => {
  it('القيم الكاملة بلا أخطاء', () => {
    expect(os.validateAllSettings(COMPLETE)).toEqual({});
  });

  it('الحقل الناقص يظهر في الأخطاء بمفتاحه', () => {
    const errors = os.validateAllSettings({ ...COMPLETE, 'report.email.cc': '' });
    expect(Object.keys(errors)).toEqual(['report.email.cc']);
  });

  it('الحمولة تحمل المفتاح والقيمة والتصنيف والوصف', () => {
    const payload = os.buildSettingsPayload(COMPLETE);
    expect(payload).toHaveLength(os.ALL_SETTING_FIELDS.length);
    const quota = payload.find((p) => p.key === 'blockers.quarterQuota');
    expect(quota.value).toBe('3');
    expect(quota.category).toBe('blockers');
    expect(quota.label).toBeTruthy();
  });

  it('الحمولة تُشذّب الفراغات ولا ترسل undefined', () => {
    const payload = os.buildSettingsPayload({ 'report.email.to': '  od@nauss.edu.sa  ' });
    const to = payload.find((p) => p.key === 'report.email.to');
    expect(to.value).toBe('od@nauss.edu.sa');
    for (const entry of payload) expect(typeof entry.value).toBe('string');
  });
});
