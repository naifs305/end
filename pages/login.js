import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://training-ops-platform-web.vercel.app';
  const pageUrl = `${siteUrl}/login`;
  const previewTitle = 'نظام إقفال الدورات التدريبية';
  const previewDescription = 'تسجيل الدخول إلى منصة حوكمة العمليات التدريبية بجامعة نايف العربية للعلوم الأمنية';
  const previewImage = `${siteUrl}/nauss-logo.png`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password, remember);
      router.push('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'بيانات الدخول غير صحيحة';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{previewTitle}</title>
        <meta name="description" content={previewDescription} />
        <meta property="og:locale" content="ar_AR" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={previewTitle} />
        <meta property="og:description" content={previewDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="جامعة نايف العربية للعلوم الأمنية" />
        <meta property="og:image" content={previewImage} />
        <meta property="og:image:alt" content="شعار جامعة نايف العربية للعلوم الأمنية" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={previewTitle} />
        <meta name="twitter:description" content={previewDescription} />
        <meta name="twitter:image" content={previewImage} />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:grid-cols-2">
            <div className="hidden lg:flex flex-col justify-center bg-primary px-10 py-12 text-white">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="relative mb-8 h-36 w-[420px] max-w-full">
                  <Image
                    src="/nauss-logo.png"
                    alt="شعار جامعة نايف"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>

                <h1 className="text-3xl font-extrabold leading-relaxed">
                  نظام إقفال الدورات التدريبية
                </h1>

                <p className="mt-3 text-base text-white/85">
                  جامعة نايف العربية للعلوم الأمنية
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center bg-background px-6 py-10 sm:px-10">
              <div className="w-full max-w-md">
                <div className="mb-8 text-center lg:hidden">
                  <div className="relative mx-auto mb-5 h-24 w-72 max-w-full">
                    <Image
                      src="/nauss-logo.png"
                      alt="شعار جامعة نايف"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>

                  <h2 className="text-2xl font-extrabold text-primary">
                    نظام إقفال الدورات التدريبية
                  </h2>
                  <p className="mt-2 text-sm text-text-soft">
                    جامعة نايف العربية للعلوم الأمنية
                  </p>
                </div>

                <div className="mb-8 text-right">
                  <h3 className="text-3xl font-extrabold text-text-main">تسجيل الدخول</h3>
                  <p className="mt-2 text-sm text-text-soft">
                    ادخل بياناتك للوصول إلى المنصة
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-text-main">
                      البريد الإلكتروني
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      dir="ltr"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="name@nauss.edu.sa"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-text-main">
                      كلمة المرور
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="أدخل كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-text-main">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      تذكرني
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                  </button>

                  <div className="text-center">
                    <Link href="/register">
                      <span className="cursor-pointer text-sm font-bold text-primary transition hover:text-primary-dark">
                        ليس لدي حساب؟ إنشاء حساب جديد
                      </span>
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}