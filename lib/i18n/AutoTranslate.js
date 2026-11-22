// ======================================================================
// مترجم الواجهة الشامل — يعمل حين تكون اللغة الإنجليزية
// ----------------------------------------------------------------------
// كثير من نصوص الشاشات ورسائل الخادم مكتوب بالعربية مباشرة لا عبر مفاتيح
// الترجمة. هذا المكوّن يترجمها في الصفحة من قاموس مستخرج من الشيفرة نفسها
// (lib/i18n/auto.en.json): كل نص ثابت، والنصوص ذات القيم المتغيّرة بأنماطها،
// والتلميحات وعناوين الحقول، والتواريخ والأرقام. ولا يمسّ بيانات المستخدمين
// (أسماء الدورات والملاحظات) لأنها ليست في القاموس، ولا ما داخل حقول الإدخال.
// وعند العودة للعربية يُعاد تحميل الصفحة فتعود نصوصها الأصلية.
// ======================================================================
import { useEffect, useRef } from 'react';
import { useTranslation } from './index';

import { buildDictionary, translateValue, translateTree, AR, ATTRS } from './autoTranslateCore';

export default function AutoTranslate() {
  const { locale } = useTranslation();
  const prev = useRef(locale);

  useEffect(() => {
    // العودة من الإنجليزية للعربية: النصوص الأصلية تعود بإعادة التحميل
    if (prev.current === 'en' && locale === 'ar') { window.location.reload(); return undefined; }
    prev.current = locale;
    if (locale !== 'en') return undefined;

    let observer;
    let cancelled = false;
    const memo = new WeakMap();
    import('./auto.en.json').then((mod) => {
      if (cancelled) return;
      const dict = buildDictionary(mod.default || mod);
      const run = (root) => { try { translateTree(dict, root, memo); } catch { /* لا يعطّل الصفحة */ } };
      run(document.body);
      if (AR.test(document.title)) { const t = translateValue(dict, document.title); if (t) document.title = t; }
      let queue = new Set();
      let scheduled = false;
      const flush = () => { scheduled = false; const items = queue; queue = new Set(); items.forEach(run); };
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'characterData') queue.add(m.target);
          else if (m.type === 'attributes') queue.add(m.target);
          else m.addedNodes.forEach((n) => queue.add(n));
        }
        if (!scheduled) { scheduled = true; setTimeout(flush, 30); }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }).catch(() => {});
    return () => { cancelled = true; observer?.disconnect(); };
  }, [locale]);

  return null;
}

