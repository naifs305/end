// =============================================================
// عميل بريزما مركزي
// -------------------------------------------------------------
// نستخدم متغيراً عاماً في بيئة التطوير حتى لا نُنشئ اتصالات
// متعددة مع قاعدة البيانات في كل إعادة تحميل.
// في الإنتاج: اتصال واحد فقط.
// =============================================================

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
module.exports.default = prisma;
