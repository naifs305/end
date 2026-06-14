import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Image from 'next/image';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import Head from 'next/head';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();

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

  useEffect(() => {
    api
      .get('/projects')
      .then((res) => setProjects(res.data))
      .catch(() => toast.error('خطأ في تحميل المشاريع'));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) return toast.error('كلمات المرور غير متطابقة');
    if (!form.acceptTerms) return toast.error('يجب الموافقة على الشروط');
    if (!form.operationalProjectId) return toast.error('يرجى اختيار المشروع التشغيلي');

    setLoading(true);
    try {
      await register(form);
      toast.success('تم إنشاء الحساب بنجاح');
      router.push('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'فشل في إنشاء الحساب';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <>
      <Head>
        <title>تسجيل حساب جديد | حوكمة العمليات التدريبية</title>
      </Head>

      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
          <div className="grid w-full max-w-6xl overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:grid-cols-2">
            <div className="hidden lg:flex flex-col justify-between bg-primary px-8 py-10 xl:px-10 xl:py-12 text-white">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white/95 p-3 shadow-lg">
                  <Image
                    src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
                    alt="شعار جامعة نايف"
                    fill
                    className="object-contain p-3"
                    unoptimized
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-extrabold">حوكمة العمليات التدريبية</h1>
                  <p className="mt-1 text-sm text-white/80">
                    جامعة نايف العربية للعلوم الأمنية
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <h2 className="text-3xl font-extrabold leading-relaxed">
                  إنشاء حساب جديد
                  <br />
                  ضمن الهوية المؤسسية
                </h2>

                <p className="mt-5 max-w-md text-sm leading-8 text-white/85">
                  بوابة موحدة لمستخدمي منصة حوكمة العمليات التدريبية، تضمن وضوح البيانات
                  وانضباط الوصول والتشغيل.
                </p>

                <div className="mt-8 h-px w-full bg-white/20" />

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    حوكمة
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    تشغيل
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
                    اعتماد
                  </span>
                </div>
              </div>

              <div className="text-xs text-white/70">
                NAUSS Training Operations Governance Platform
              </div>
            </div>

            <div className="flex items-center justify-center bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
              <div className="w-full max-w-2xl">
                <div className="mb-6 text-center lg:hidden">
                  <div className="relative mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:h-24 sm:w-24">
                    <Image
                      src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
                      alt="شعار جامعة نايف"
                      fill
                      className="object-contain p-3"
                      unoptimized
                    />
                  </div>

                  <h2 className="text-xl font-extrabold text-primary sm:text-2xl">
                    حوكمة العمليات التدريبية
                  </h2>
                  <p className="mt-2 text-sm text-text-soft">
                    جامعة نايف العربية للعلوم الأمنية
                  </p>
                </div>

                <div className="mb-6 text-right sm:mb-8">
                  <h3 className="text-2xl font-extrabold text-text-main sm:text-3xl">
                    تسجيل حساب جديد
                  </h3>
                  <p className="mt-2 text-sm text-text-soft">
                    أدخل بياناتك الرسمية لإنشاء حساب في المنصة
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        الاسم الأول
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        required
                        value={form.firstName}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        الاسم الأخير
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        value={form.lastName}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main">
                      البريد الإلكتروني الرسمي
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      dir="ltr"
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="name@nauss.edu.sa"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        رقم الجوال
                      </label>
                      <input
                        type="text"
                        name="mobileNumber"
                        required
                        value={form.mobileNumber}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        التحويلة
                      </label>
                      <input
                        type="text"
                        name="extensionNumber"
                        value={form.extensionNumber}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-main">
                      المشروع التشغيلي
                    </label>
                    <select
                      name="operationalProjectId"
                      required
                      value={form.operationalProjectId}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        اختر المشروع
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        كلمة المرور
                      </label>
                      <input
                        type="password"
                        name="password"
                        required
                        value={form.password}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-text-main">
                        تأكيد كلمة المرور
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        required
                        value={form.confirmPassword}
                        onChange={handleChange}
                        className={inputClass}
                      />
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
                        أقر بأن جميع البيانات المدخلة صحيحة ودقيقة، وأتحمل المسؤولية الكاملة
                        عن أي بيانات غير صحيحة أو مضللة يتم إدخالها في المنصة.
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
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