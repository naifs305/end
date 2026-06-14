const crypto = require('crypto');

function encodeHeaderUtf8(value) {
  if (!value) return '';
  const text = String(value);
  return /[^\x00-\x7F]/.test(text)
    ? `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
    : text;
}

function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r?\n/g, '\r\n');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeFilename(filename, fallback = 'attachment.bin') {
  const name = String(filename || '').trim();
  if (!name) return fallback;
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], contentBase64: match[2] };
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((file, index) => {
      const parsed = parseDataUrl(file?.content);
      if (!parsed) return null;
      const ext = parsed.mimeType.split('/')[1] || 'bin';
      return {
        filename: sanitizeFilename(file?.name, `attachment-${index + 1}.${ext}`),
        mimeType: parsed.mimeType,
        contentBase64: parsed.contentBase64,
      };
    })
    .filter(Boolean);
}

function wrapBase64(value) {
  return String(value || '').match(/.{1,76}/g)?.join('\r\n') || '';
}

function buildEmlMessage({ to, cc, subject, htmlBody, textBody, attachments = [] }) {
  const mixedBoundary = `mixed_${crypto.randomBytes(12).toString('hex')}`;
  const altBoundary = `alt_${crypto.randomBytes(12).toString('hex')}`;
  const lines = [];

  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(`Subject: ${encodeHeaderUtf8(subject)}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push('X-Unsent: 1');
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  lines.push('');
  lines.push(`--${mixedBoundary}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  lines.push('');
  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrapBase64(Buffer.from(normalizeLineBreaks(textBody || stripHtml(htmlBody)), 'utf8').toString('base64')));
  lines.push('');
  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrapBase64(Buffer.from(normalizeLineBreaks(htmlBody), 'utf8').toString('base64')));
  lines.push('');
  lines.push(`--${altBoundary}--`);
  lines.push('');

  attachments.forEach((attachment) => {
    lines.push(`--${mixedBoundary}`);
    lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
    lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(wrapBase64(attachment.contentBase64));
    lines.push('');
  });

  lines.push(`--${mixedBoundary}--`);
  lines.push('');

  return normalizeLineBreaks(lines.join('\r\n'));
}

module.exports = {
  buildEmlMessage,
  normalizeAttachments,
  sanitizeFilename,
};
