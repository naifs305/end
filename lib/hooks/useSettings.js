import { useState, useEffect } from 'react';
import api from '../axios';

// تخزين مؤقت على مستوى الوحدة لخريطة الإعدادات (key/value)
let cache = null;
let inflight = null;

/**
 * يجلب إعدادات النظام (AppSetting) كخريطة key/value من قاعدة البيانات.
 * @returns {{ settings: Record<string,string>, get: (key:string, fallback?:string)=>string, loading: boolean }}
 */
export function useSettings() {
  const [settings, setSettings] = useState(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    if (cache) {
      setSettings(cache);
      setLoading(false);
      return () => { mounted = false; };
    }
    if (!inflight) {
      inflight = api
        .get('/settings')
        .then((res) => {
          cache = res.data && typeof res.data === 'object' ? res.data : {};
          return cache;
        })
        .catch(() => {
          cache = {};
          return cache;
        })
        .finally(() => {
          inflight = null;
        });
    }
    inflight.then((map) => {
      if (mounted) {
        setSettings(map);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const get = (key, fallback = '') => (settings && settings[key] != null ? settings[key] : fallback);

  return { settings, get, loading };
}

export default useSettings;
