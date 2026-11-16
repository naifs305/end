import { describe, it, expect } from 'vitest';

const links = require('./elementLinks');

describe('العناصر المترابطة', () => {
  it('تفعيل السلفة يفتح تسويتها', () => {
    expect(links.deriveLinkedFlags({ requiresAdvance: true }))
      .toEqual({ requiresAdvanceSettlement: true });
  });

  it('إلغاء السلفة يُلغي تسويتها — لا تسوية لسلفة لم تُؤخذ', () => {
    expect(links.deriveLinkedFlags({ requiresAdvance: false }))
      .toEqual({ requiresAdvanceSettlement: false });
  });

  it('لا يُلتفت إلى ما يُرسله المنسق في الحقل التابع', () => {
    const derived = links.deriveLinkedFlags({
      requiresAdvance: true,
      requiresAdvanceSettlement: false,
    });
    expect(derived.requiresAdvanceSettlement).toBe(true);
  });

  it('الحقل الذي لم يصل لا يُشتق منه شيء — فالتعديل الجزئي يبقى جزئياً', () => {
    expect(links.deriveLinkedFlags({ name: 'دورة' })).toEqual({});
    expect(links.deriveLinkedFlags({})).toEqual({});
  });

  it('القيمة غير المنطقية تُقرأ منطقياً', () => {
    expect(links.deriveLinkedFlags({ requiresAdvance: 'نعم' }))
      .toEqual({ requiresAdvanceSettlement: true });
    expect(links.deriveLinkedFlags({ requiresAdvance: null }))
      .toEqual({ requiresAdvanceSettlement: false });
  });

  it('الحقل التابع معروف بأنه تابع — فتُخفيه الواجهة', () => {
    expect(links.isDerivedFlag('requiresAdvanceSettlement')).toBe(true);
    expect(links.isDerivedFlag('requiresAdvance')).toBe(false);
    expect(links.isDerivedFlag('requiresRevenue')).toBe(false);
  });

  it('لكل ترابط سببٌ مكتوب — فلا يُحذف بعد سنة بلا فهم', () => {
    expect(links.LINKED_FLAGS.length).toBeGreaterThan(0);
    for (const link of links.LINKED_FLAGS) {
      expect(link.when).toBeTruthy();
      expect(link.then).toBeTruthy();
      expect(link.why).toBeTruthy();
    }
  });
});
