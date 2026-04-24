const crypto = require('crypto');

function escapeHeader(value = '') {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function foldBase64(value = '') {
  return String(value).replace(/(.{76})/g, '$1\r\n');
}

function encodeBase64Utf8(value = '') {
  return foldBase64(Buffer.from(String(value), 'utf8').toString('base64'));
}

function parseDataUri(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

function sanitizeFilename(name = 'attachment') {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAsciiFilename(name = 'report') {
  const cleaned = String(name)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();

  return cleaned || 'report';
}

function encodeMimeWord(value = '') {
  const text = escapeHeader(value);
  if (!text) return '';
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function buildReportEml({ subject, html, to, cc, attachments = [] }) {
  const boundaryMixed = `mixed_${crypto.randomBytes(8).toString('hex')}`;
  const boundaryAlt = `alt_${crypto.randomBytes(8).toString('hex')}`;
  const plainText = 'يرجى الاطلاع على التقرير المرفق.';

  const parts = [
    'MIME-Version: 1.0',
    `To: ${escapeHeader(to)}`,
    cc ? `Cc: ${escapeHeader(cc)}` : null,
    `Subject: ${encodeMimeWord(subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    '',
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Utf8(plainText),
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Utf8(html),
    '',
    `--${boundaryAlt}--`,
  ].filter(Boolean);

  const attachmentParts = attachments
    .map((file, index) => {
      const parsed = parseDataUri(file?.content);
      if (!parsed) return null;
      const originalName = sanitizeFilename(file?.name || `attachment-${index + 1}`);
      const filename = encodeMimeWord(originalName);
      return [
        `--${boundaryMixed}`,
        `Content-Type: ${parsed.contentType}; name="${filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${filename}"`,
        '',
        foldBase64(parsed.base64),
        '',
      ].join('\r\n');
    })
    .filter(Boolean);

  return [
    parts.join('\r\n'),
    ...attachmentParts,
    `--${boundaryMixed}--`,
    '',
  ].join('\r\n');
}

module.exports = {
  buildReportEml,
  toAsciiFilename,
};
