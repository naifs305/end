import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serveSession, borrowSession, isPublicPath } from './sessionShare';

// لكل نافذة تخزين جلستها الخاص، وتتشارك النوافذ قناة واحدة
const store = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('مشاركة الجلسة بين النوافذ', () => {
  beforeEach(() => { globalThis.window = { BroadcastChannel }; });
  afterEach(() => { delete globalThis.window; });

  it('النافذة الجديدة تأخذ الجلسة من النافذة المفتوحة', async () => {
    const opener = store();
    opener.setItem('token', 'T1');
    opener.setItem('activeRole', 'EMPLOYEE');
    const stop = serveSession(opener);
    const fresh = store();
    expect(await borrowSession(500, fresh)).toBe(true);
    expect(fresh.getItem('token')).toBe('T1');
    expect(fresh.getItem('activeRole')).toBe('EMPLOYEE');
    stop();
  });

  it('نافذة بلا جلسة لا تجيب، فتعود الجديدة بلا جلسة', async () => {
    const stop = serveSession(store());
    expect(await borrowSession(80, store())).toBe(false);
    stop();
  });
});

describe('المجلة العامة لا تُحوِّل إلى الدخول', () => {
  it.each([['/m/abc', true], ['/m', true], ['/messages', false], ['/motivation', false], ['/courses/1/documentation/print', false]])('%s', (p, want) => {
    expect(isPublicPath(p)).toBe(want);
  });
});
