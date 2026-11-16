import { describe, it, expect, vi } from 'vitest';

const pp = require('./passport');

// العيّنة المعيارية في وثيقة ICAO 9303 (بيانات وهمية)
const L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

describe('قراءة الجواز — المنطقة المقروءة آلياً', () => {
  it('أرقام التحقق المعيارية (٧-٣-١)', () => {
    expect(pp.checkDigit('L898902C3')).toBe('6');
    expect(pp.checkDigit('740812')).toBe('2');
    expect(pp.checkDigit('120415')).toBe('9');
    expect(pp.checkDigit('<<<<')).toBe('0');
  });

  it('يحلل السطرين ويتحقق منهما', () => {
    const m = pp.parseMrz(L1, L2);
    expect(m).toMatchObject({
      issuer: 'UTO', surname: 'ERIKSSON', givenNames: 'ANNA MARIA', nameEn: 'ANNA MARIA ERIKSSON',
      passportNo: 'L898902C3', nationalityCode: 'UTO', birthDate: '1974-08-12', sex: 'F', expiry: '2012-04-15', valid: true,
    });
  });

  it('يتسامح مع المسافات وعلامات «» والحروف الصغيرة التي قد يقرؤها المساعد', () => {
    const m = pp.parseMrz(L1.toLowerCase().replace(/</g, '«'), `${L2.slice(0, 20)} ${L2.slice(20)}`);
    expect(m.valid).toBe(true);
  });

  it('خانة واحدة خاطئة تُسقط التحقق', () => {
    const bad = `L898902C4${L2.slice(9)}`;
    const m = pp.parseMrz(L1, bad);
    expect(m.checks.number).toBe(false);
    expect(m.valid).toBe(false);
  });

  it('ما ليس جوازاً لا يُحلل', () => {
    expect(pp.parseMrz('I<UTOD231458907<<<<<<<<<<<<<<<', L2)).toBeNull();
    expect(pp.parseMrz('', '')).toBeNull();
  });
});

describe('قراءة الجواز — مطابقة قراءة المساعد', () => {
  const base = { isPassport: true, mrzLine1: L1, mrzLine2: L2, nameEn: 'anna maria eriksson', nameAr: '', nationality: 'سويدية', passportNo: 'L8989O2C3', birthDate: '1974-08-12', expiry: '2012-04-15', sex: 'F', issuingCountry: 'Utopia' };

  it('أرقام التحقق السليمة تصحّح ما أخطأ المساعد في قراءته من النص المطبوع', () => {
    const r = pp.reconcile(base);
    expect(r.verified).toBe(true);
    expect(r.fields).toMatchObject({ passportNo: 'L898902C3', nameEn: 'ANNA MARIA ERIKSSON', nationality: 'سويدية', passportExpiry: '2012-04-15' });
    expect(r.warnings).toEqual([]);
  });

  it('ينبّه حين لا يُقرأ السطران', () => {
    const r = pp.reconcile({ ...base, mrzLine1: '', mrzLine2: '' });
    expect(r.verified).toBe(false);
    expect(r.warnings[0]).toContain('السطران');
  });

  it('ينبّه إن انتهى الجواز قبل الدورة أو قلّت صلاحيته عن ستة أشهر بعدها', () => {
    expect(pp.reconcile(base, { courseEnd: '2026-12-18' }).warnings).toContain('الجواز ينتهي قبل نهاية الدورة');
    const soon = pp.reconcile({ ...base, mrzLine1: '', mrzLine2: '', expiry: '2027-02-01' }, { courseEnd: '2026-12-18' });
    expect(soon.warnings.some((w) => w.includes('ستة أشهر'))).toBe(true);
    const fine = pp.reconcile({ ...base, mrzLine1: '', mrzLine2: '', expiry: '2030-01-01' }, { courseEnd: '2026-12-18' });
    expect(fine.warnings.some((w) => w.includes('ستة أشهر'))).toBe(false);
  });

  it('صورة ليست جوازاً تُرفض برسالة واضحة', () => {
    expect(() => pp.reconcile({ ...base, isPassport: false })).toThrow(/جواز/);
  });

  it('يقبل الصور وملفات PDF فقط، ويرفض الحجم الكبير', () => {
    expect(pp.toContent('data:image/jpeg;base64,AAAA').type).toBe('image');
    expect(pp.toContent('data:application/pdf;base64,AAAA').type).toBe('document');
    expect(() => pp.toContent('data:text/html;base64,AAAA')).toThrow(/الصيغة/);
    expect(() => pp.toContent('hello')).toThrow();
    const big = `data:image/png;base64,${'A'.repeat(12 * 1024 * 1024)}`;
    expect(() => pp.toContent(big)).toThrow(/٨/);
  });

  it('يرسل الملف للمساعد ولا يعيد الصورة، ثم يطابق القراءة', async () => {
    const ai = { askJson: vi.fn().mockResolvedValue(base) };
    const r = await pp.readPassport({ file: 'data:image/png;base64,AAAA', courseEnd: null }, ai);
    const call = ai.askJson.mock.calls[0][0];
    expect(call.content[0]).toMatchObject({ type: 'image', source: { media_type: 'image/png' } });
    expect(call.schema.required).toContain('mrzLine2');
    expect(r.fields.passportNo).toBe('L898902C3');
    expect(JSON.stringify(r)).not.toContain('AAAA');
  });
});
