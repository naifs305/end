import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Upload, Trash2, Save, KeyRound, Mail, MailCheck, User } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, locale } = useTranslation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    extensionNumber: '',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const isManager = (user?.roles || []).includes('MANAGER');

  const profileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  useEffect(() => {
    api.get('/profile')
      .then((res) => {
        const d = res.data;
        setForm({
          firstName: d.firstName || '',
          lastName: d.lastName || '',
          mobileNumber: d.mobileNumber || '',
          extensionNumber: d.extensionNumber || '',
        });
        setProfileImage(d.profileImage || null);
        setSignatureImage(d.signatureImage || null);
      })
      .catch(() => toast.error(t('profile.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.mustBeImage'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('profile.imageTooLarge'));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (field === 'profileImage') setProfileImage(dataUrl);
      else setSignatureImage(dataUrl);
    } catch {
      toast.error(t('profile.imageReadFailed'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return toast.error(t('profile.nameRequired'));
    }
    if (!form.mobileNumber.trim()) {
      return toast.error(t('profile.mobileRequired'));
    }

    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        extensionNumber: form.extensionNumber.trim() || null,
        profileImage,
        signatureImage,
      };
      const res = await api.patch('/profile', payload);

      // تحديث بيانات المستخدم في سياق المصادقة والتخزين المحلي
      const updatedUser = { ...user, ...res.data };
      setUser?.(updatedUser);
      const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
      storage.setItem('cachedUser', JSON.stringify(updatedUser));

      toast.success(t('profile.saveSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPwForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendTestEmail = async () => {
    setTestSending(true);
    try {
      const payload = testEmail.trim() ? { to: testEmail.trim() } : {};
      const res = await api.post('/admin/email-test', payload);
      if (res.data?.sent) {
        toast.success(t('profile.testEmailSent', { to: res.data.to }));
      } else {
        toast.error(t('profile.testEmailFailed'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('profile.testEmailError'));
    } finally {
      setTestSending(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword) return toast.error(t('profile.currentPasswordRequired'));
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error(t('profile.newPasswordMismatch'));
    if (pwForm.newPassword.length < 8) return toast.error(t('profile.newPasswordMinLength'));

    setPwSaving(true);
    try {
      await api.put('/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success(t('profile.passwordChanged'));
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || t('profile.passwordChangeFailed'));
    } finally {
      setPwSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';
  const labelClass = 'mb-1.5 block text-sm font-bold text-text-main';

  return (
    <MainLayout>
      <Head>
        <title>{`${t('profile.title')} | ${t('common.appName')}`}</title>
      </Head>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main">{t('profile.title')}</h1>
          <p className="mt-1 text-sm text-text-soft">{t('profile.subtitle')}</p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center text-text-soft">{t('common.loading')}</div>
        ) : (
          <>
            {/* البيانات الأساسية */}
            <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-text-main">{t('profile.basicInfo')}</h2>

              {/* الصورة الشخصية */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                  {profileImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profileImage} alt={t('common.profileImage')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-text-soft">
                      {(form.firstName?.[0] || '') + (form.lastName?.[0] || '') || <User size={28} aria-hidden="true" />}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e, 'profileImage')}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => profileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-text-main transition hover:bg-background"
                    >
                      <Upload size={14} aria-hidden="true" /> {t('profile.changeImage')}
                    </button>
                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => setProfileImage(null)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 px-4 py-2 text-xs font-bold text-danger transition hover:bg-burgundy/5"
                      >
                        <Trash2 size={14} aria-hidden="true" /> {t('profile.remove')}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-text-soft">{t('profile.imageHint')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('profile.firstName')}</label>
                  <input name="firstName" value={form.firstName} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.lastName')}</label>
                  <input name="lastName" value={form.lastName} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.mobileNumber')}</label>
                  <input name="mobileNumber" value={form.mobileNumber} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.extension')}</label>
                  <input name="extensionNumber" value={form.extensionNumber} onChange={handleChange} className={inputClass} placeholder={t('common.optional')} />
                </div>
                <div>
                  <label className={labelClass}>{t('common.email')}</label>
                  <input value={user?.email || ''} disabled dir="ltr" className={`${inputClass} cursor-not-allowed bg-background text-text-soft text-start`} />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.role')}</label>
                  <input
                    value={(user?.roles || []).map((r) => t(`roles.${r}`)).join(locale === 'en' ? ', ' : '، ')}
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-background text-text-soft`}
                  />
                  <p className="mt-1 text-[11px] text-text-soft">{t('profile.roleHint')}</p>
                </div>
              </div>

              {/* التوقيع الإلكتروني */}
              <div>
                <label className={labelClass}>{t('profile.signature')}</label>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-48 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                    {signatureImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={signatureImage} alt={t('profile.signature')} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-text-soft">{t('profile.noSignature')}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageChange(e, 'signatureImage')}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => signatureInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-text-main transition hover:bg-background"
                      >
                        <Upload size={14} aria-hidden="true" /> {t('profile.uploadSignature')}
                      </button>
                      {signatureImage && (
                        <button
                          type="button"
                          onClick={() => setSignatureImage(null)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 px-4 py-2 text-xs font-bold text-danger transition hover:bg-burgundy/5"
                        >
                          <Trash2 size={14} aria-hidden="true" /> {t('profile.remove')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {saving ? (
                    t('common.saving')
                  ) : (
                    <>
                      <Save size={16} aria-hidden="true" /> {t('profile.saveChanges')}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* تغيير كلمة المرور */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-3xl border border-border bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-text-main">{t('profile.changePassword')}</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>{t('profile.currentPassword')}</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={pwForm.currentPassword}
                    onChange={handlePasswordChange}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.newPassword')}</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={pwForm.newPassword}
                    onChange={handlePasswordChange}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('profile.confirmNewPassword')}</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={pwForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-soft">{t('profile.passwordPolicy')}</p>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {pwSaving ? (
                    t('profile.changing')
                  ) : (
                    <>
                      <KeyRound size={16} aria-hidden="true" /> {t('profile.changePassword')}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* اختبار البريد الإلكتروني — للمدير فقط */}
            {isManager && (
              <div className="space-y-4 rounded-3xl border border-border bg-white p-5 sm:p-6">
                <h2 className="text-lg font-extrabold text-text-main">{t('profile.emailTest')}</h2>
                <p className="text-sm text-text-soft">{t('profile.emailTestDescription')}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className={labelClass}>{t('profile.targetEmail')}</label>
                    <div className="relative">
                      <Mail size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3.5" />
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder={user?.email || 'example@nauss.edu.sa'}
                        dir="ltr"
                        className="w-full rounded-2xl border border-border bg-white py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ps-11 pe-4 text-start"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testSending}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                  >
                    {testSending ? (
                      t('profile.sending')
                    ) : (
                      <>
                        <MailCheck size={16} aria-hidden="true" /> {t('profile.sendTestEmail')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
