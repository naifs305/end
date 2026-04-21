import axios from 'axios';

// =============================================================
// بعد الدمج: الواجهة والخادم في نفس التطبيق
// المسار الأساسي دائماً /api (نسبي للموقع نفسه)
// =============================================================

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

export default instance;