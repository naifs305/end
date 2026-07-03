const prisma = require('../../lib/db/prisma');

export default async function handler(req, res) {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      status: 'ok',
      database: 'ok',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({
      status: 'error',
      database: 'error',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  }
}
