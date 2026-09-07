import { useState, useEffect } from 'react';
import api from '../axios';
import { useTranslation } from '../i18n';

// تخزين مؤقت على مستوى الوحدة لتفادي إعادة الجلب لكل ظهور للمكوّن
const cache = new Map();

// قيم افتراضية مدمجة للقوائم الثابتة التي لا تتغيّر.
// تُستخدم إذا كان الجدول في قاعدة البيانات فارغاً أو تعذّر الوصول إليه،
// حتى لا تظهر قوائم فارغة تمنع إنشاء الدورات.
const BUILTIN = {
  LOCATION_TYPE: [
    { value: 'INTERNAL', labelAr: 'داخلي',   labelEn: 'Internal' },
    { value: 'EXTERNAL', labelAr: 'خارجي',   labelEn: 'External' },
    { value: 'REMOTE',   labelAr: 'عن بُعد', labelEn: 'Remote'   },
  ],
  COURSE_TYPE: [
    { value: 'internal', labelAr: 'داخلية', labelEn: 'Internal' },
    { value: 'external', labelAr: 'خارجية', labelEn: 'External' },
  ],
};

/**
 * يجلب قائمة خيارات من قاعدة البيانات حسب الفئة (CITY / COURSE_TYPE / LOCATION_TYPE...).
 * يعيد عناصر جاهزة للعرض: { value, label }‎ حيث label يتبع لغة الواجهة.
 *
 * @param {string} category فئة القائمة
 * @returns {{ options: Array<{value:string,label:string,labelAr:string,labelEn:string}>, loading: boolean }}
 */
export function useOptions(category) {
  const { locale } = useTranslation();
  const [raw, setRaw] = useState(() => cache.get(category) || BUILTIN[category] || []);
  const [loading, setLoading] = useState(() => !cache.has(category));

  useEffect(() => {
    if (!category) return;
    let mounted = true;

    if (cache.has(category)) {
      setRaw(cache.get(category));
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    api
      .get('/options', { params: { category } })
      .then((res) => {
        const fetched = Array.isArray(res.data) ? res.data : [];
        const list = fetched.length ? fetched : (BUILTIN[category] || []);
        cache.set(category, list);
        if (mounted) {
          setRaw(list);
          setLoading(false);
        }
      })
      .catch(() => {
        // تعذّر الوصول لقاعدة البيانات: نرجع للقيم المدمجة
        const fallback = BUILTIN[category] || [];
        cache.set(category, fallback);
        if (mounted) {
          setRaw(fallback);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [category]);

  const options = raw.map((o) => ({
    value: o.value,
    label: locale === 'en' ? o.labelEn : o.labelAr,
    labelAr: o.labelAr,
    labelEn: o.labelEn,
  }));

  return { options, loading };
}

// يترجم قيمة مخزّنة إلى تسميتها حسب اللغة (للعرض في الجداول/البطاقات)
export function useOptionLabel() {
  const { locale } = useTranslation();
  return (category, value) => {
    const list = cache.get(category) || BUILTIN[category] || [];
    const found = list.find((o) => o.value === value);
    if (!found) return value;
    return locale === 'en' ? found.labelEn : found.labelAr;
  };
}

export default useOptions;
