function encodeHeader(value = '') {
  return `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function quotedPrintableUtf8(input = '') {
  const buffer = Buffer.from(String(input), 'utf8');
  let out = '';
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0x0d && buffer[i + 1] === 0x0a) {
      out += '\r\n';
      i += 1;
      continue;
    }
    if ((byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126) || byte === 0x09 || byte === 0x20) {
      out += String.fromCharCode(byte);
    } else {
      out += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }

  const lines = [];
  const rawLines = out.split(/\r\n/);
  rawLines.forEach((line) => {
    let current = line;
    while (current.length > 73) {
      lines.push(`${current.slice(0, 73)}=`);
      current = current.slice(73);
    }
    lines.push(current);
  });
  return lines.join('\r\n');
}

function sanitizeFileName(name = 'attachment') {
  return String(name).replace(/[\\/:*?"<>|]+/g, '-');
}

function parseDataUrl(dataUrl = '') {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2] || '',
  };
}

function chunkBase64(base64 = '') {
  return String(base64).replace(/(.{76})/g, '$1\r\n');
}

function buildReportEml({ subject, html, attachments = [], to, cc }) {
  const boundaryMixed = `mix_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const boundaryAlt = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const plainText = 'مرفق لكم تقرير الدورة بصيغة HTML داخل الرسالة، مع المرفقات الداعمة.';

  const lines = [
    `To: ${to}`,
    `Cc: ${cc}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    '',
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    quotedPrintableUtf8(plainText),
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    quotedPrintableUtf8(html),
    '',
    `--${boundaryAlt}--`,
  ];

  attachments.forEach((attachment, index) => {
    const parsed = parseDataUrl(attachment.content);
    if (!parsed) return;
    const fallbackName = `attachment-${index + 1}.jpg`;
    const fileName = sanitizeFileName(attachment.name || fallbackName);
    lines.push(
      '',
      `--${boundaryMixed}`,
      `Content-Type: ${parsed.mimeType}; name="${fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${fileName}"`,
      '',
      chunkBase64(parsed.base64),
    );
  });

  lines.push('', `--${boundaryMixed}--`, '');
  return lines.join('\r\n');
}

function buildReportMailMeta({ courseName, reportType }) {
  const safeCourseName = courseName || 'دورة تدريبية';
  const safeType = reportType || 'تقرير الدورة';
  return {
    to: 'OD@NAUSS.EDU.SA',
    cc: 'NALSHAHRANI@NAUSS.EDU.SA',
    subject: `${safeType} - ${safeCourseName}`,
  };
}

module.exports = {
  buildReportEml,
  buildReportMailMeta,
  escapeHtml,
};
