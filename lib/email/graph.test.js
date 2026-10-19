import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// الوحدة تقرأ المتغيرات عند التحميل — نضبطها ثم نعيد تحميلها في كل اختبار
async function loadGraph() {
  vi.resetModules();
  return import('./graph.js');
}

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  };
}

describe('graph (Microsoft 365) transport', () => {
  beforeEach(() => {
    vi.stubEnv('MS_GRAPH_TENANT_ID', 'tenant-1');
    vi.stubEnv('MS_GRAPH_CLIENT_ID', 'client-1');
    vi.stubEnv('MS_GRAPH_CLIENT_SECRET', 'secret-1');
    vi.stubEnv('MS_GRAPH_SENDER', 'od@nauss.edu.sa');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is not configured without all three credentials', async () => {
    vi.stubEnv('MS_GRAPH_CLIENT_SECRET', '');
    const graph = await loadGraph();
    expect(graph.isGraphConfigured).toBe(false);
  });

  it('gets a client-credentials token, then posts sendMail as the sender mailbox', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(202, {}, { 'request-id': 'req-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const graph = await loadGraph();

    const res = await graph.sendViaGraph({ to: 'a@nauss.edu.sa', subject: 'S', html: '<p>x</p>' });

    expect(res).toEqual({ id: 'req-1', provider: 'm365' });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    expect(String(tokenInit.body)).toContain('grant_type=client_credentials');

    const [mailUrl, mailInit] = fetchMock.mock.calls[1];
    expect(mailUrl).toBe('https://graph.microsoft.com/v1.0/users/od%40nauss.edu.sa/sendMail');
    expect(mailInit.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(mailInit.body).message).toMatchObject({
      subject: 'S',
      body: { contentType: 'HTML', content: '<p>x</p>' },
      toRecipients: [{ emailAddress: { address: 'a@nauss.edu.sa' } }],
    });
  });

  it('sends from the override mailbox and reuses the cached token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValue(jsonResponse(202, {}));
    vi.stubGlobal('fetch', fetchMock);
    const graph = await loadGraph();

    await graph.sendViaGraph({ to: 'a@x.sa', subject: 'S', html: 'h' });
    await graph.sendViaGraph({ to: 'b@x.sa', subject: 'S', html: 'h', fromAddress: 'otp@nauss.edu.sa' });

    expect(fetchMock).toHaveBeenCalledTimes(3); // رمز واحد + رسالتان
    expect(fetchMock.mock.calls[2][0]).toContain('/users/otp%40nauss.edu.sa/sendMail');
  });

  it('throws with the Graph error code when sending is refused', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } })));
    const graph = await loadGraph();

    await expect(graph.sendViaGraph({ to: 'a@x.sa', subject: 'S', html: 'h' }))
      .rejects.toThrow(/403.*ErrorAccessDenied/);
  });

  it('throws when the token request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      jsonResponse(401, { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret' })
    ));
    const graph = await loadGraph();

    await expect(graph.sendViaGraph({ to: 'a@x.sa', subject: 'S', html: 'h' }))
      .rejects.toThrow(/AADSTS7000215/);
  });
});
