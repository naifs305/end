import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  EMPLOYEE: 'موظف',
  PROJECT_SUPERVISOR: 'مشرف مشروع',
  MANAGER: 'مدير',
  QUALITY_VIEWER: 'مراقب جودة',
};

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
      .catch(() => toast.error('خطأ في تحميل الملف الشخصي'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يجب اختيار ملف صورة');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 4 ميجابايت)');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (field === 'profileImage') setProfileImage(dataUrl);
      else setSignatureImage(dataUrl);
    } catch {
      toast.error('فشل في قراءة الصورة');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return toast.error('الاسم الأول والأخير مطلوبان');
    }
    if (!form.mobileNumber.trim()) {
      return toast.error('رقم الجوال مطلوب');
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

      toast.success('تم حفظ التعديلات بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في حفظ التعديلات');
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
        toast.success(`تم إرسال رسالة الاختبار إلى ${res.data.to}`);
      } else {
        toast.error('تعذر إرسال رسالة الاختبار — تحقق من إعدادات البريد');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في إرسال رسالة الاختبار');
    } finally {
      setTestSending(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword) return toast.error('كلمة المرور الحالية مطلوبة');
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('كلمتا المرور الجديدتان غير متطابقتين');
    if (pwForm.newPassword.length < 8) return toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');

    setPwSaving(true);
    try {
      await api.put('/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في تغيير كلمة المرور');
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
        <title>ملفي الشخصي | حوكمة العمليات التدريبية</title>
      </Head>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main">ملفي الشخصي</h1>
          <p className="mt-1 text-sm text-text-soft">عرض وتعديل بياناتك الشخصية، صورتك، توقيعك، وكلمة المرور</p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center text-text-soft">جاري التحميل...</div>
        ) : (
          <>
            {/* البيانات الأساسية */}
            <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-text-main">البيانات الأساسية</h2>

              {/* الصورة الشخصية */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                  {profileImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profileImage} alt="الصورة الشخصية" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-text-soft">
                      {(form.firstName?.[0] || '') + (form.lastName?.[0] || '')}
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
                      className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-text-main transition hover:bg-background"
                    >
                      تغيير الصورة
                    </button>
                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => setProfileImage(null)}
                        className="rounded-xl border border-danger/30 px-4 py-2 text-xs font-bold text-danger transition hover:bg-burgundy/5"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-text-soft">PNG أو JPG أو WEBP — حتى 4 ميجابايت</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>الاسم الأول</label>
                  <input name="firstName" value={form.firstName} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>الاسم الأخير</label>
                  <input name="lastName" value={form.lastName} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>رقم الجوال</label>
                  <input name="mobileNumber" value={form.mobileNumber} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>التحويلة</label>
                  <input name="extensionNumber" value={form.extensionNumber} onChange={handleChange} className={inputClass} placeholder="اختياري" />
                </div>
                <div>
                  <label className={labelClass}>البريد الإلكتروني</label>
                  <input value={user?.email || ''} disabled className={`${inputClass} cursor-not-allowed bg-background text-text-soft`} />
                </div>
                <div>
                  <label className={labelClass}>الدور</label>
                  <input
                    value={(user?.roles || []).map((r) => ROLE_LABELS[r] || r).join('، ')}
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-background text-text-soft`}
                  />
                  <p className="mt-1 text-[11px] text-text-soft">تعديل الدور حصري لصلاحية المدير</p>
                </div>
              </div>

              {/* التوقيع الإلكتروني */}
              <div>
                <label className={labelClass}>التوقيع الإلكتروني</label>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-48 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                    {signatureImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={signatureImage} alt="التوقيع الإلكتروني" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-text-soft">لا يوجد توقيع</span>
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
                        className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-text-main transition hover:bg-background"
                      >
                        رفع توقيع
                      </button>
                      {signatureImage && (
                        <button
                          type="button"
                          onClick={() => setSignatureImage(null)}
                          className="rounded-xl border border-danger/30 px-4 py-2 text-xs font-bold text-danger transition hover:bg-burgundy/5"
                        >
                          إزالة
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
                  className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>

            {/* تغيير كلمة المرور */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-3xl border border-border bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-text-main">تغيير كلمة المرور</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>كلمة المرور الحالية</label>
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
                  <label className={labelClass}>كلمة المرور الجديدة</label>
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
                  <label className={labelClass}>تأكيد كلمة المرور الجديدة</label>
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
              <p className="text-[11px] text-text-soft">يجب أن تكون كلمة المرور 8 أحرف على الأقل وتحتوي على حروف وأرقام</p>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {pwSaving ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </form>

            {/* اختبار البريد الإلكتروني — للمدير فقط */}
            {isManager && (
              <div className="space-y-4 rounded-3xl border border-border bg-white p-5 sm:p-6">
                <h2 className="text-lg font-extrabold text-text-main">اختبار البريد الإلكتروني</h2>
                <p className="text-sm text-text-soft">
                  أرسل رسالة اختبار للتأكد من وصول البريد وظهور شعار الجامعة بشكل صحيح. اتركه فارغاً للإرسال إلى بريدك الحالي.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className={labelClass}>البريد الإلكتروني المستهدف</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={user?.email || 'example@nauss.edu.sa'}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testSending}
                    className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60"
                  >
                    {testSending ? 'جاري الإرسال...' : 'إرسال رسالة اختبار'}
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
