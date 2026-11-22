import { describe, it, expect } from 'vitest';

const { buildDictionary, translateValue, dateOrNumber } = require('./autoTranslateCore');
const raw = require('./auto.en.json');

const dict = buildDictionary(raw);

describe('مترجم الواجهة الشامل', () => {
  it('النص الثابت يُترجم من القاموس', () => {
    expect(translateValue(dict, 'رصيد الإنجاز')).toBe('Achievement balance');
    expect(translateValue(dict, '  أرسل التذكير  ')).toBe('Send reminder');
  });

  it('النص ذو القيم المتغيّرة يُترجم بنمطه وتبقى قيمه', () => {
    expect(translateValue(dict, 'ذكّر المنسق (٣)')).toBe('Remind the coordinator (3)');
    expect(translateValue(dict, 'حصّل ١٢ من ٢٠ ممكنة')).toBe('Earned 12 of 20 possible');
  });

  it('التواريخ والأرقام العربية', () => {
    expect(dateOrNumber('١٧ نوفمبر ٢٠٢٦')).toBe('17 November 2026');
    expect(dateOrNumber('٣٤٠')).toBe('340');
  });

  it('بيانات المستخدم غير المعروفة لا تُمسّ', () => {
    expect(translateValue(dict, 'إدارة الحشود في الملاعب')).toBeNull();
  });

  it('القاموس يغطي كل الأنماط بقيم صالحة', () => {
    for (const [k, v] of Object.entries(raw.patterns)) {
      const holes = k.split('{}').length - 1;
      const used = new Set((v.match(/\{(\d+)\}/g) || []).map((x) => Number(x.slice(1, -1))));
      for (const n of used) expect(n).toBeLessThan(holes);
    }
  });
});
