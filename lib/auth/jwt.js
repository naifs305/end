// =============================================================
// طبقة المصادقة - توليد الرموز والتحقق منها
// =============================================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_EXPIRES_IN = '7d';

// مطلوب في كل البيئات — لا يوجد احتياطي ثابت (يمنع تزوير الرموز)
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  throw new Error('متغير JWT_SECRET مفقود أو قصير — أضف سراً عشوائياً (٣٢ محرفاً على الأقل) في إعدادات البيئة');
}

// -------- كلمات المرور --------

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// -------- الرموز --------

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}

// -------- رمز التحدي الثنائي (MFA) --------
// رمز قصير العمر يُثبت اجتياز كلمة المرور فقط، ويُوقَّع بمفتاح مشتق مختلف:
// لا يمكن قبوله كرمز جلسة في withAuth (يفشل التوقيع) ولا العكس.
const MFA_SECRET = `${SECRET}::mfa`;
const MFA_EXPIRES_IN = '10m';

function signMfaToken(payload) {
  return jwt.sign(payload, MFA_SECRET, { expiresIn: MFA_EXPIRES_IN, audience: 'mfa' });
}

function verifyMfaToken(token) {
  try {
    return jwt.verify(String(token || ''), MFA_SECRET, { audience: 'mfa' });
  } catch (err) {
    return null;
  }
}

// -------- استخراج المستخدم من الطلب --------

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function getUserFromRequest(req) {
  const token = extractToken(req);
  if (!token) return null;
  return verifyToken(token);
}

function getActiveRole(req) {
  return req.headers['x-active-role'] || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  signMfaToken,
  verifyMfaToken,
  extractToken,
  getUserFromRequest,
  getActiveRole,
};
