// =============================================================
// طبقة المصادقة - توليد الرموز والتحقق منها
// =============================================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('متغير JWT_SECRET مفقود — أضفه في إعدادات البيئة');
}

const SECRET = JWT_SECRET || 'dev_secret_change_in_production';

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
  extractToken,
  getUserFromRequest,
  getActiveRole,
};
