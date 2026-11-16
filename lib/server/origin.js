// أصل المنصة كما يراه الزائر (لروابط المجلة ورموز QR): من إعداد صريح
// إن وُجد، وإلا من ترويسات الطلب نفسه — فيصح على خادم الجامعة وغيره.
function publicOrigin(req) {
  const fixed = process.env.PUBLIC_BASE_URL;
  if (fixed) return fixed.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket?.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

module.exports = { publicOrigin };
