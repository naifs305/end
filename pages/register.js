import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Image from 'next/image';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import Head from 'next/head';
import { Mail, Lock, Eye, EyeOff, User, Phone, Hash, FolderKanban, UserPlus } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import LanguageSwitcher from '../components/layout/LanguageSwitcher';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    extensionNumber: '',
    password: '',
    confirmPassword: '',
    operationalProjectId: '',
    acceptTerms: false,
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api
      .get('/projects')
      .then((res) => setProjects(res.data))
      .catch(() => toast.error(t('register.loadProjectsFailed')));
  }, [t]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) return toast.error(t('register.passwordMismatch'));
    if (!form.acceptTerms) return toast.error(t('register.mustAcceptTerms'));
    if (!form.operationalProjectId) return toast.error(t('register.selectProjectRequired'));

    setLoading(true);
    try {
      await register(form);
      toast.success(t('register.success'));
      router.push('/');
    } catch (err) {
      const msg = err.response?.data?.message || t('register.failed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-4 text-start';

  return (
    <>
      <Head>
        <title>{`${t('register.title')} | ${t('common.appName')}`}</title>
      </Head>

      <div className="relative min-h-screen bg-background">
        {/* مبدّل اللغة في الزاوية العلوية */}
        <div className="absolute top-4 z-10 end-4">
          <LanguageSwitcher variant="pill" />
        </div>

        <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
          <div className="grid w-full max-w-6xl overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:grid-cols-2">
            <div className="hidden lg:flex flex-col justify-between bg-primary px-8 py-10 xl:px-10 xl:py-12 text-white">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white/95 p-3 shadow-lg">
                  <Image
                    src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
                    alt={t('common.university')}
                    fill
                    className="object-contain p-3"
                    unoptimized
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-extrabold">{t('common.appName')}</h1>
                  <p className="mt-1 text-sm text-white/80">{t('common.university')}</p>
                </div>
              </div>

              <div className="mt-10">
                <h2 className="text-3xl font-extrabold leading-relaxed">{t('register.heroTitle')}</h2>

                <p className="mt-5 max-w-md text-sm leading-8 text-white/85">{t('register.heroDescription')}</p>

                <div className="mt-8 h-px w-full bg-white/20" />

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    {t('register.tagGovernance')}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    {t('register.tagOperations')}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    {t('register.tagApproval')}
                  </span>
                </div>
              </div>

              <div className="text-xs text-white/70">NAUSS Training Operations Governance Platform</div>
            </div>

            <div className="flex items-center justify-center bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
              <div className="w-full max-w-2xl">
                <div className="mb-6 text-center lg:hidden">
                  <div className="relative mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:h-24 sm:w-24">
                    <Image
                      src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
                      alt={t('common.university')}
                      fill
                      className="object-contain p-3"
                      unoptimized
                    />
                  </div>

                  <h2 className="text-xl font-extrabold text-primary sm:text-2xl">{t('common.appName')}</h2>
                  <p className="mt-2 text-sm text-text-soft">{t('common.university')}</p>
                </div>

                <div className="mb-6 text-start sm:mb-8">
                  <h3 className="text-2xl font-extrabold text-text-main sm:text-3xl">{t('register.title')}</h3>
                  <p className="mt-2 text-sm text-text-soft">{t('register.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.firstName')}</label>
                      <div className="relative">
                        <User size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input type="text" name="firstName" required value={form.firstName} onChange={handleChange} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.lastName')}</label>
                      <div className="relative">
                        <User size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input type="text" name="lastName" required value={form.lastName} onChange={handleChange} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.officialEmail')}</label>
                    <div className="relative">
                      <Mail size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                      <input
                        type="email"
                        name="email"
                        required
                        dir="ltr"
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t('auth.emailPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.mobileNumber')}</label>
                      <div className="relative">
                        <Phone size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input type="text" name="mobileNumber" required value={form.mobileNumber} onChange={handleChange} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.extension')}</label>
                      <div className="relative">
                        <Hash size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input type="text" name="extensionNumber" value={form.extensionNumber} onChange={handleChange} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.operationalProject')}</label>
                    <div className="relative">
                      <FolderKanban size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                      <select
                        name="operationalProjectId"
                        required
                        value={form.operationalProjectId}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="" disabled>
                          {t('register.selectProject')}
                        </option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('auth.password')}</label>
                      <div className="relative">
                        <Lock size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          required
                          value={form.password}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-11"
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

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">{t('register.confirmPassword')}</label>
                      <div className="relative">
                        <Lock size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          name="confirmPassword"
                          required
                          value={form.confirmPassword}
                          onChange={handleChange}
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
                  </div>

                  <div className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        id="terms"
                        name="acceptTerms"
                        type="checkbox"
                        checked={form.acceptTerms}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="terms" className="block text-sm leading-7 text-text-main">
                        {t('register.termsText')}
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      t('register.submitting')
                    ) : (
                      <>
                        <UserPlus size={18} aria-hidden="true" />
                        {t('register.createAccount')}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
