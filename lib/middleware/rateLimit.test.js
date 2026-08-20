import { describe, it, expect } from 'vitest';
const { withRateLimit, clientIp, setRateLimitStore } = require('./rateLimit');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('rateLimit.clientIp (M5: anti-spoof IP derivation)', () => {
  it('prefers x-real-ip (set by the trusted proxy)', () => {
    expect(clientIp({ headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '6.6.6.6' }, socket: {} })).toBe('1.2.3.4');
  });

  it('takes the trusted last hop of x-forwarded-for, not the spoofable first entry', () => {
    // مهاجم يضيف "spoof" في المقدمة — نأخذ القفزة الأخيرة الموثوقة
    expect(clientIp({ headers: { 'x-forwarded-for': 'spoof, 203.0.113.9' }, socket: {} })).toBe('203.0.113.9');
  });

  it('falls back to the socket address', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });
});

describe('rateLimit.withRateLimit', () => {
  it('passes through under the limit and returns 429 once exceeded', async () => {
    const limited = withRateLimit({ maxAttempts: 2, windowMs: 10_000 })(
      async (req, res) => res.status(200).json({ ok: true }),
    );
    const req = { headers: { 'x-real-ip': '5.5.5.5' }, url: '/api/test-429', socket: {} };

    const r1 = mockRes(); await limited(req, r1); expect(r1.statusCode).toBe(200);
    const r2 = mockRes(); await limited(req, r2); expect(r2.statusCode).toBe(200);
    const r3 = mockRes(); await limited(req, r3);
    expect(r3.statusCode).toBe(429);
    expect(r3.headers['Retry-After']).toBeDefined();
  });

  it('supports a pluggable async store with an atomic incr', async () => {
    const calls = [];
    setRateLimitStore({
      async incr(key) { calls.push(key); return { count: 99, windowStart: Date.now(), windowMs: 1000 }; },
    });
    const limited = withRateLimit({ maxAttempts: 5, windowMs: 1000 })(async (req, res) => res.status(200).json({ ok: true }));
    const res = mockRes();
    await limited({ headers: { 'x-real-ip': '8.8.8.8' }, url: '/api/store', socket: {} }, res);
    expect(calls.length).toBe(1);    // استُخدم incr من المخزن المحقون
    expect(res.statusCode).toBe(429); // 99 > 5
    // نعيد المخزن الافتراضي حتى لا تتأثر بقية الاختبارات
    setRateLimitStore(undefined);
  });
});
