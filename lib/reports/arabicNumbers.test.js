import { describe, it, expect } from 'vitest';

const n = require('./arabicNumbers');

describe('تفقيط الأرقام', () => {
  it('الصفر', () => {
    expect(n.integerToArabicWords(0)).toBe('صفر');
  });

  it('الوحدات', () => {
    expect(n.integerToArabicWords(1)).toBe('واحد');
    expect(n.integerToArabicWords(2)).toBe('اثنان');
    expect(n.integerToArabicWords(9)).toBe('تسعة');
  });

  it('العشرات والعقود', () => {
    expect(n.integerToArabicWords(10)).toBe('عشرة');
    expect(n.integerToArabicWords(11)).toBe('أحد عشر');
    expect(n.integerToArabicWords(12)).toBe('اثنا عشر');
    expect(n.integerToArabicWords(19)).toBe('تسعة عشر');
    expect(n.integerToArabicWords(20)).toBe('عشرون');
    expect(n.integerToArabicWords(21)).toBe('واحد وعشرون');
    expect(n.integerToArabicWords(99)).toBe('تسعة وتسعون');
  });

  it('المئات بصيغها الصحيحة', () => {
    expect(n.integerToArabicWords(100)).toBe('مائة');
    expect(n.integerToArabicWords(200)).toBe('مائتان');
    expect(n.integerToArabicWords(300)).toBe('ثلاثمائة');
    expect(n.integerToArabicWords(800)).toBe('ثمانمائة');
    expect(n.integerToArabicWords(900)).toBe('تسعمائة');
  });

  it('المئات مع ما بعدها', () => {
    expect(n.integerToArabicWords(101)).toBe('مائة وواحد');
    expect(n.integerToArabicWords(115)).toBe('مائة وخمسة عشر');
    expect(n.integerToArabicWords(345)).toBe('ثلاثمائة وخمسة وأربعون');
  });

  it('الآلاف تتبع قاعدة العربية لا الإنجليزية', () => {
    expect(n.integerToArabicWords(1000)).toBe('ألف');
    expect(n.integerToArabicWords(2000)).toBe('ألفان');
    expect(n.integerToArabicWords(3000)).toBe('ثلاثة آلاف');
    expect(n.integerToArabicWords(6000)).toBe('ستة آلاف');
    expect(n.integerToArabicWords(10000)).toBe('عشرة آلاف');
    expect(n.integerToArabicWords(11000)).toBe('أحد عشر ألفاً');
    expect(n.integerToArabicWords(12000)).toBe('اثنا عشر ألفاً');
    // مضاعفات المائة تأتي بالمفرد المضاف إليه
    expect(n.integerToArabicWords(100000)).toBe('مائة ألف');
    expect(n.integerToArabicWords(200000)).toBe('مائتا ألف');
    expect(n.integerToArabicWords(105000)).toBe('مائة وخمسة آلاف');
    expect(n.integerToArabicWords(20000)).toBe('عشرون ألفاً');
  });

  it('الآلاف مع ما بعدها', () => {
    expect(n.integerToArabicWords(12500)).toBe('اثنا عشر ألفاً وخمسمائة');
    expect(n.integerToArabicWords(1250)).toBe('ألف ومائتان وخمسون');
  });

  it('الملايين', () => {
    expect(n.integerToArabicWords(1000000)).toBe('مليون');
    expect(n.integerToArabicWords(2000000)).toBe('مليونان');
    expect(n.integerToArabicWords(5000000)).toBe('خمسة ملايين');
  });
});

describe('المبلغ كما يُكتب في المستند المالي', () => {
  it('المبلغان في مسودة العقد', () => {
    expect(n.amountInWords(12000)).toBe('اثنا عشر ألفاً ريال سعودي لا غير');
    expect(n.amountInWords(6000)).toBe('ستة آلاف ريال سعودي لا غير');
  });

  it('الهللات تُكتب حين تكون', () => {
    expect(n.amountInWords(1500.5)).toContain('هللة');
    expect(n.amountInWords(1500.5)).toContain('خمسون هللة');
  });

  it('المبلغ الصحيح لا يذكر هللة', () => {
    expect(n.amountInWords(1500)).not.toContain('هللة');
  });

  it('المبلغ غير الصحيح يرجع فارغاً — لا نكتب ما لا نعرف', () => {
    expect(n.amountInWords(null)).toBe('');
    expect(n.amountInWords('ألف ريال')).toBe('');
    expect(n.amountInWords(-10)).toBe('');
  });
});

describe('الأرقام العربية الهندية والتنسيق', () => {
  it('يحوّل الأرقام للشهادات والنماذج', () => {
    expect(n.toArabicDigits('2026/11/16')).toBe('٢٠٢٦/١١/١٦');
  });

  it('يضع فواصل الآلاف', () => {
    expect(n.formatAmount(12000)).toBe('12,000');
    expect(n.formatAmount(1500.5)).toBe('1,500.5');
  });
});
