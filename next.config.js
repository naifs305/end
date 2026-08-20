/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // تحسين حجم الحزم: استيراد انتقائي من المكتبات الكبيرة (أيقونات/رسوم)
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  // شعار الجامعة يُحمَّل من نطاق nauss.edu.sa (SVG)
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline',
    remotePatterns: [
      { protocol: 'https', hostname: 'nauss.edu.sa' },
    ],
  },
  // كتم تحذير webpack الحميد القادم من react-datepicker
  // (يستخدم require ديناميكياً لتحميل لغات date-fns — لا يؤثر على التشغيل)
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/react-datepicker/ },
    ];
    return config;
  },
  async headers() {
    // سياسة أمان المحتوى (CSP) — دفاع متعدّد الطبقات.
    // ملاحظة: نسمح بـ 'unsafe-inline'/'unsafe-eval' للسكربتات لأن نكست (موجّه الصفحات)
    // يحقن سكربتات هيدراشن مضمّنة؛ و data: للصور لأن صور الملف الشخصي تُخزّن base64.
    // يمكن تشديدها لاحقاً باستخدام nonce.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;