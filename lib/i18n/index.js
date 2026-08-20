import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import ar from './locales/ar.json';
import en from './locales/en.json';

// ── القواميس المجمّعة (بذرة/احتياطي إن تعذّر الوصول لقاعدة البيانات) ──
const BUNDLED = { ar, en };

const TRANSLATIONS_CACHE_KEY = 'translations-cache';
const TRANSLATIONS_TTL_MS = 5 * 60 * 1000; // 5 دقائق

// دمج عميق: قيم قاعدة البيانات تُغطّي البذرة المجمّعة
function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const LOCALES = [
  { code: 'ar', label: 'العربية', short: 'ع', dir: 'rtl' },
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
];

export const DEFAULT_LOCALE = 'ar';
const STORAGE_KEY = 'locale';

function getDir(locale) {
  return locale === 'en' ? 'ltr' : 'rtl';
}

// يقرأ مفتاحاً بصيغة "common.save" من قاموس متداخل
function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), dict);
}

// يستبدل المتغيرات {name} داخل النص
function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  dir: 'rtl',
  isRTL: true,
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  // القواميس النشطة: تبدأ بالبذرة المجمّعة ثم تُدمج فوقها قيم قاعدة البيانات
  const [dicts, setDicts] = useState(BUNDLED);

  // التحميل الأولي من التخزين المحلي (بعد التحميل لتجنب تعارض الـ hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BUNDLED[saved]) setLocaleState(saved);
    } catch {
      /* تجاهل */
    }
  }, []);

  // تحميل الترجمات من قاعدة البيانات ودمجها فوق البذرة المجمّعة
  useEffect(() => {
    let mounted = true;

    const apply = (db) => {
      if (!mounted || !db) return;
      setDicts({
        ar: deepMerge(BUNDLED.ar, db.ar),
        en: deepMerge(BUNDLED.en, db.en),
      });
    };

    try {
      const cachedRaw = sessionStorage.getItem(TRANSLATIONS_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached.timestamp && Date.now() - cached.timestamp < TRANSLATIONS_TTL_MS) {
          apply(cached.db);
          return () => {
            mounted = false;
          };
        }
      }
    } catch {
      /* تجاهل المخزّن المؤقت التالف */
    }

    axios
      .get('/api/translations')
      .then((res) => {
        apply(res.data);
        try {
          sessionStorage.setItem(
            TRANSLATIONS_CACHE_KEY,
            JSON.stringify({ db: res.data, timestamp: Date.now() })
          );
        } catch {
          /* تجاهل */
        }
      })
      .catch(() => {
        /* تعذّر الوصول لقاعدة البيانات — نكتفي بالبذرة المجمّعة */
      });

    return () => {
      mounted = false;
    };
  }, []);

  // مزامنة اتجاه ولغة عنصر <html> عند تغيّر اللغة
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = getDir(locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!BUNDLED[next]) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* تجاهل */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* تجاهل */
      }
      return next;
    });
  }, []);

  // مترجم النصوص: يبحث في اللغة الحالية ثم العربية ثم يعيد المفتاح نفسه
  const t = useCallback(
    (key, vars) => {
      if (!key) return '';
      const active = lookup(dicts[locale], key);
      if (active != null) return interpolate(active, vars);
      const fallback = lookup(dicts[DEFAULT_LOCALE], key);
      if (fallback != null) return interpolate(fallback, vars);
      return key;
    },
    [locale, dicts]
  );

  const value = useMemo(
    () => ({
      locale,
      dir: getDir(locale),
      isRTL: getDir(locale) === 'rtl',
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}

export default useTranslation;
