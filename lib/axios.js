import axios from 'axios';
import ar from './i18n/locales/ar.json';
import en from './i18n/locales/en.json';

// =============================================================
// بعد الدمج: الواجهة والخادم في نفس التطبيق
// المسار الأساسي دائماً /api (نسبي للموقع نفسه)
// =============================================================

// ── ترجمة رسائل الخطأ القادمة من الخادم حسب رمزها (code) ──────
const BUNDLED = { ar, en };
function lookupKey(dict, key) {
  return key.split('.').reduce((acc, p) => (acc && acc[p] != null ? acc[p] : undefined), dict);
}
function translateServerError(code) {
  if (typeof window === 'undefined' || !code) return null;
  let locale = 'ar';
  try {
    locale = localStorage.getItem('locale') || 'ar';
  } catch {}
  // أولاً: ترجمات قاعدة البيانات المخزّنة مؤقتاً، ثم البذرة المجمّعة، ثم العربية
  try {
    const cachedRaw = sessionStorage.getItem('translations-cache');
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      const v = cached?.db?.[locale] && lookupKey(cached.db[locale], code);
      if (v != null) return v;
    }
  } catch {}
  return lookupKey(BUNDLED[locale] || BUNDLED.ar, code) ?? lookupKey(BUNDLED.ar, code) ?? null;
}

const instance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const activeRole = localStorage.getItem('activeRole') || sessionStorage.getItem('activeRole');

      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      if (activeRole) {
        config.headers['x-active-role'] = activeRole;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ترجمة رسالة الخطأ من رمزها إلى لغة الواجهة الحالية
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.response?.data?.code;
    if (code) {
      const translated = translateServerError(code);
      if (translated) error.response.data.message = translated;
    }
    return Promise.reject(error);
  }
);

export default instance;