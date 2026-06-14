import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [emailVal, setEmailVal] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!emailVal.trim()) { toast.error('أدخل بريدك الإلكتروني'); return; }
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">

          {/* شعار */}
          <div className="mb-6 text-center">
            <div className="relative mx-auto mb-4 h-12 w-40">
              <Image src="/nauss-logo.png" alt="جامعة نايف" fill className="object-contain" priority />
            </div>
          </div>

          {sent ? (
            <div className="text-center">
              <p className="text-5xl mb-4">📧</p>
              <h1 className="text-xl font-extrabold text-primary mb-2">تحقق من بريدك</h1>
              <p className="text-sm text-text-soft leading-relaxed">
                إذا كان الحساب موجوداً، ستصل رسالة تحتوي على رابط إعادة تعيين كلمة المرور خلال لحظات.
              </p>
              <p className="text-xs text-text-soft/60 mt-3">الرابط صالح لمدة ساعة واحدة فقط.</p>
              <Link href="/login"
                className="mt-6 inline-block rounded-2xl border border-border px-6 py-2.5 text-sm font-bold text-text-main hover:bg-background transition">
                ← العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-4xl mb-3">🔐</p>
                <h1 className="text-xl font-extrabold text-primary">استعادة كلمة المرور</h1>
                <p className="text-xs text-text-soft mt-1">أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={emailVal}
                    onChange={e => setEmailVal(e.target.value)}
                    placeholder="name@nauss.edu.sa"
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition">
                  {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-xs text-text-soft hover:text-primary">← العودة لتسجيل الدخول</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
