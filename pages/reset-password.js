import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, ArrowLeft, Save } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import LanguageSwitcher from '../components/layout/LanguageSwitcher';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t('resetPassword.minLength'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('resetPassword.mismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast.success(t('resetPassword.changed'));
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('resetPassword.invalidLink'));
    } finally {
      setLoading(false);
    }
  };

  const strengthLabel =
    password.length >= 10
      ? t('resetPassword.strengthExcellent')
      : password.length >= 8
      ? t('resetPassword.strengthGood')
      : password.length >= 6
      ? t('resetPassword.strengthFair')
      : t('resetPassword.strengthWeak');

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      {/* مبدّل اللغة في الزاوية العلوية */}
      <div className="absolute top-4 z-10 end-4">
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
          {done ? (
            <div className="text-center">
              <CheckCircle2 size={48} aria-hidden="true" className="mx-auto mb-4 text-accent" />
              <h1 className="text-xl font-extrabold text-primary mb-2">{t('resetPassword.doneTitle')}</h1>
              <p className="text-sm text-text-soft">{t('resetPassword.redirecting')}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <KeyRound size={40} aria-hidden="true" className="mx-auto mb-3 text-primary" />
                <h1 className="text-xl font-extrabold text-primary">{t('resetPassword.title')}</h1>
                <p className="text-xs text-text-soft mt-1">{t('resetPassword.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">{t('resetPassword.newPassword')}</label>
                  <div className="relative">
                    <Lock size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('resetPassword.minPlaceholder')}
                      required
                      className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? t('common.close') : t('common.view')}
                      className="absolute top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-soft transition hover:text-primary end-3"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">{t('resetPassword.confirmPassword')}</label>
                  <div className="relative">
                    <Lock size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={t('resetPassword.confirmPlaceholder')}
                      required
                      className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? t('common.close') : t('common.view')}
                      className="absolute top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-soft transition hover:text-primary end-3"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* مقياس القوة */}
                {password && (
                  <div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-forest-50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          password.length >= 10
                            ? 'w-full bg-accent'
                            : password.length >= 8
                            ? 'w-3/4 bg-primary'
                            : password.length >= 6
                            ? 'w-1/2 bg-sand'
                            : 'w-1/4 bg-danger'
                        }`}
                      />
                    </div>
                    <p className={`text-[11px] mt-1 ${password.length >= 8 ? 'text-accent' : 'text-text-soft'}`}>{strengthLabel}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition"
                >
                  {loading ? (
                    t('resetPassword.saving')
                  ) : (
                    <>
                      <Save size={18} aria-hidden="true" />
                      {t('resetPassword.saveNewPassword')}
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-text-soft hover:text-primary">
              <ArrowLeft size={14} aria-hidden="true" />
              {t('resetPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
