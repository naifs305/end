import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Mail, MailCheck, KeyRound, ArrowLeft, Send } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import LanguageSwitcher from '../components/layout/LanguageSwitcher';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [emailVal, setEmailVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailVal.trim()) {
      toast.error(t('forgotPassword.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: emailVal.trim() });
      setSent(true);
    } catch {
      // نُظهر نجاحاً دائماً لمنع تخمين الحسابات
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      {/* مبدّل اللغة في الزاوية العلوية */}
      <div className="absolute top-4 z-10 end-4">
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
          {/* شعار */}
          <div className="mb-6 text-center">
            <div className="relative mx-auto mb-4 h-12 w-40">
              <Image src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg" alt={t('common.university')} fill className="object-contain" priority />
            </div>
          </div>

          {sent ? (
            <div className="text-center">
              <MailCheck size={48} aria-hidden="true" className="mx-auto mb-4 text-accent" />
              <h1 className="text-xl font-extrabold text-primary mb-2">{t('forgotPassword.checkInboxTitle')}</h1>
              <p className="text-sm text-text-soft leading-relaxed">{t('forgotPassword.checkInboxText')}</p>
              <p className="text-xs text-text-soft/60 mt-3">{t('forgotPassword.linkValidity')}</p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 rounded-2xl border border-border px-6 py-2.5 text-sm font-bold text-text-main hover:bg-background transition"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <KeyRound size={40} aria-hidden="true" className="mx-auto mb-3 text-primary" />
                <h1 className="text-xl font-extrabold text-primary">{t('forgotPassword.title')}</h1>
                <p className="text-xs text-text-soft mt-1">{t('forgotPassword.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">{t('auth.email')}</label>
                  <div className="relative">
                    <Mail size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                    <input
                      type="email"
                      value={emailVal}
                      onChange={(e) => setEmailVal(e.target.value)}
                      placeholder={t('auth.emailPlaceholder')}
                      required
                      dir="ltr"
                      className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-4 text-start"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition"
                >
                  {loading ? (
                    t('forgotPassword.sending')
                  ) : (
                    <>
                      <Send size={18} aria-hidden="true" />
                      {t('forgotPassword.sendLink')}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-text-soft hover:text-primary">
                  <ArrowLeft size={14} aria-hidden="true" />
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
