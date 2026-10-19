/**
 * الإرسال عبر Microsoft 365 — Microsoft Graph (sendMail)
 *
 * المصادقة: OAuth2 client credentials (تطبيق مسجّل في Entra ID) — بلا كلمة مرور
 * صندوق بريد، ولا يعتمد على SMTP AUTH (الذي أوقفته Microsoft لـ Exchange Online).
 *
 * المتغيرات:
 *   MS_GRAPH_TENANT_ID     — معرّف المستأجر (Directory/tenant ID)
 *   MS_GRAPH_CLIENT_ID     — معرّف التطبيق (Application/client ID)
 *   MS_GRAPH_CLIENT_SECRET — سر التطبيق (Client secret value)
 *   MS_GRAPH_SENDER        — صندوق المُرسِل الافتراضي (مثل od@nauss.edu.sa)
 *
 * الصلاحية المطلوبة: Mail.Send (Application) + موافقة المدير، ويُفضَّل تقييدها
 * بصندوق المُرسِل وحده (Application Access Policy / RBAC for Applications).
 */

const TENANT_ID     = process.env.MS_GRAPH_TENANT_ID;
const CLIENT_ID     = process.env.MS_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET;
const DEFAULT_SENDER = process.env.MS_GRAPH_SENDER || 'od@nauss.edu.sa';

const isGraphConfigured = !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET);

// ── رمز الوصول مع تخزين مؤقت حتى قبيل انتهائه ────────────────────────────────
let cachedToken = null;
let cachedUntil = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;

  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`token ${res.status}: ${json.error_description || json.error || 'unknown error'}`);
  }

  cachedToken = json.access_token;
  cachedUntil = Date.now() + Math.max(0, (Number(json.expires_in) || 3600) - 120) * 1000;
  return cachedToken;
}

function recipients(to) {
  return (Array.isArray(to) ? to : String(to).split(','))
    .map((a) => String(a).trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
}

// يُرجع { id } عند القبول (202)، ويرمي خطأً عند الفشل
async function sendViaGraph({ to, subject, html, fromAddress }) {
  const sender = fromAddress || DEFAULT_SENDER;
  const token = await getAccessToken();

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: recipients(to),
      },
      saveToSentItems: false,
    }),
  });

  if (res.status === 401) cachedToken = null; // رمز ملغى — يُجدَّد في المحاولة التالية
  if (res.status !== 202) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`sendMail ${res.status} (${sender}): ${json.error?.code || ''} ${json.error?.message || ''}`.trim());
  }
  return { id: res.headers.get('request-id') || 'graph', provider: 'm365' };
}

module.exports = { isGraphConfigured, sendViaGraph, DEFAULT_SENDER };
