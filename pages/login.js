import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import LanguageSwitcher from '../components/layout/LanguageSwitcher';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://training-ops-platform-web.vercel.app';
  const pageUrl = `${siteUrl}/login`;
  const previewTitle = t('auth.systemTitle');
  const previewDescription = t('auth.metaDescription');
  const previewImage = 'https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg';
  const siteName = t('common.university');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password, remember);
      router.push('/');
    } catch (err) {
      const msg = err.response?.data?.message || t('auth.invalidCredentials');
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
        <meta property="og:locale" content={locale === 'en' ? 'en_US' : 'ar_AR'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={previewTitle} />
        <meta property="og:description" content={previewDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:image" content={previewImage} />
        <meta property="og:image:alt" content={siteName} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={previewTitle} />
        <meta name="twitter:description" content={previewDescription} />
        <meta name="twitter:image" content={previewImage} />
      </Head>

      <div className="relative min-h-screen bg-background">
        {/* مبدّل اللغة في الزاوية العلوية */}
        <div className="absolute top-4 z-10 end-4">
          <LanguageSwitcher variant="pill" />
        </div>

        <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:grid-cols-2">
            {/* اللوحة الجانبية الترحيبية */}
            <div className="relative hidden flex-col justify-center overflow-hidden bg-gradient-to-br from-primary to-primary-dark px-10 py-12 text-white lg:flex">
              {/* خلفية بنمط هوية الجامعة (خافتة) */}
              <Image
                src="/naif_arab_university_for_security_sciences_cover.jpeg"
                alt=""
                fill
                aria-hidden="true"
                className="object-cover opacity-10 mix-blend-luminosity"
              />
              {/* لمسة زخرفية بهوية الجامعة */}
              <div className="pointer-events-none absolute -top-16 -end-16 h-56 w-56 rounded-full bg-accent/10 blur-2xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-white/5 blur-2xl" aria-hidden="true" />
              <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="relative mb-8 h-28 w-[360px] max-w-full">
                  <Image src="/logo.svg" alt={t('common.university')} fill className="object-contain" priority />
                </div>
                <h1 className="text-3xl font-extrabold leading-relaxed">{t('auth.systemTitle')}</h1>
                <p className="mt-3 text-base text-white/85">{t('common.university')}</p>
              </div>
            </div>

            {/* نموذج الدخول */}
            <div className="flex items-center justify-center bg-background px-6 py-10 sm:px-10">
              <div className="w-full max-w-md">
                <div className="mb-8 text-center lg:hidden">
                  <div className="relative mx-auto mb-5 h-24 w-72 max-w-full">
                    <Image src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg" alt={t('common.university')} fill className="object-contain" priority />
                  </div>
                  <h2 className="text-2xl font-extrabold text-primary">{t('auth.systemTitle')}</h2>
                  <p className="mt-2 text-sm text-text-soft">{t('common.university')}</p>
                </div>

                <div className="mb-8 text-start">
                  <h3 className="text-3xl font-extrabold text-text-main">{t('auth.loginTitle')}</h3>
                  <p className="mt-2 text-sm text-text-soft">{t('auth.loginSubtitle')}</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  {/* البريد الإلكتروني */}
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-text-main">
                      {t('auth.email')}
                    </label>
                    <div className="relative">
                      <Mail
                        size={18}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5"
                      />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        dir="ltr"
                        className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-4 text-start"
                        placeholder={t('auth.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* كلمة المرور */}
                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-text-main">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <Lock
                        size={18}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5"
                      />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-11"
                        placeholder={t('auth.passwordPlaceholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t('common.close') : t('common.view')}
                        className="absolute top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-soft transition hover:text-primary end-3"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
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
                      {t('auth.rememberMe')}
                    </label>
                    <Link href="/forgot-password" className="text-sm text-text-soft transition hover:text-primary">
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      t('auth.signingIn')
                    ) : (
                      <>
                        <LogIn size={18} aria-hidden="true" />
                        {t('auth.signIn')}
                      </>
                    )}
                  </button>

                  <div className="text-center">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-primary transition hover:text-primary-dark"
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                      {t('auth.noAccount')}
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
