// =============================================================
// العناصر المترابطة
// -------------------------------------------------------------
// بعض عناصر الإقفال تتبع غيرها حتماً، فلا تُترك خياراً مستقلاً
// يُنسى أو يُلغى سهواً. تُشتق هنا في مكان واحد، ويُطبَّق الاشتقاق
// في الخادم عند إنشاء الدورة وعند تعديلها — فلا يعتمد على الواجهة.
//
// وهذا هو موضع أي ترابط جديد: أضفه إلى LINKED_FLAGS وحدها.
// =============================================================

const LINKED_FLAGS = [
  {
    when: 'requiresAdvance',
    then: 'requiresAdvanceSettlement',
    // لا تُؤخذ سلفة مؤقتة بلا تسوية، ولا تُسوَّى سلفة لم تُؤخذ
    why: 'تسوية السلفة تتبع طلب السلفة',
  },
];

/**
 * يشتق الحقول التابعة من الحقول التي وصلت في الطلب.
 * الحقل الذي لم يصل لا يُشتق منه شيء — فالتعديل الجزئي يبقى جزئياً.
 */
function deriveLinkedFlags(source = {}) {
  const derived = {};
  for (const link of LINKED_FLAGS) {
    if (source[link.when] === undefined) continue;
    derived[link.then] = !!source[link.when];
  }
  return derived;
}

/** هل هذا الحقل تابع لغيره؟ (الواجهة تُخفي التابع فلا يُعرض خياراً) */
function isDerivedFlag(field) {
  return LINKED_FLAGS.some((link) => link.then === field);
}

module.exports = {
  LINKED_FLAGS,
  deriveLinkedFlags,
  isDerivedFlag,
};
