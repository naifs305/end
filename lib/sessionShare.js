// ======================================================================
// مشاركة جلسة الدخول بين نوافذ المتصفح
// ----------------------------------------------------------------------
// من يدخل دون «تذكّرني» تُحفظ جلسته في النافذة وحدها، فإذا فتح صفحة في
// نافذة جديدة (المجلة، التقرير الفني…) وصلت بلا جلسة فحُوِّل إلى الدخول.
// هنا تسأل النافذة الجديدة النوافذ المفتوحة عن الجلسة فتأخذها منها.
// ======================================================================
const CHANNEL = 'itmam-session';
const KEYS = ['token', 'cachedUser', 'activeRole'];

const supported = () => typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';

/** الصفحات العامة (المجلة بالرابط) لا تُحوِّل إلى الدخول أبداً */
export function isPublicPath(pathname) {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return /^\/m(\/|$)/.test(p);
}

/** تجيب هذه النافذة من يسألها عن الجلسة إن كانت جلستها خاصة بها */
export function serveSession(store = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!supported() || !store) return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e) => {
    if (e.data?.type !== 'request') return;
    let session = null;
    try {
      if (store.getItem('token')) session = Object.fromEntries(KEYS.map((k) => [k, store.getItem(k)]));
    } catch {}
    if (session) ch.postMessage({ type: 'session', id: e.data.id, session });
  };
  return () => ch.close();
}

/** تسأل النوافذ المفتوحة عن جلسة، وتحفظها في هذه النافذة إن وصلت */
export function borrowSession(timeoutMs = 400, store = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!supported() || !store) return Promise.resolve(false);
  return new Promise((resolve) => {
    const ch = new BroadcastChannel(CHANNEL);
    const id = Math.random().toString(36).slice(2);
    const done = (got) => { clearTimeout(timer); ch.close(); resolve(got); };
    const timer = setTimeout(() => done(false), timeoutMs);
    ch.onmessage = (e) => {
      if (e.data?.type !== 'session' || e.data.id !== id || !e.data.session?.token) return;
      try {
        KEYS.forEach((k) => { if (e.data.session[k]) store.setItem(k, e.data.session[k]); });
        done(true);
      } catch { done(false); }
    };
    ch.postMessage({ type: 'request', id });
  });
}
