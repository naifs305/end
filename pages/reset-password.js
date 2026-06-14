import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [showPw,    setShowPw]    = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (password.length < 6)      { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirm)      { toast.error('كلمتا المرور غير متطابقتين'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast.success('تم تغيير كلمة المرور ✓');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'الرابط غير صالح أو منتهٍ');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">

          {done ? (
            <div className="text-center">
              <p className="text-5xl mb-4">✅</p>
              <h1 className="text-xl font-extrabold text-primary mb-2">تم تغيير كلمة المرور</h1>
              <p className="text-sm text-text-soft">سيتم توجيهك لصفحة تسجيل الدخول...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-4xl mb-3">🔑</p>
                <h1 className="text-xl font-extrabold text-primary">إعادة تعيين كلمة المرور</h1>
                <p className="text-xs text-text-soft mt-1">أدخل كلمة مرور جديدة لحسابك</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      required
                      className={inputCls}
                    />
                    <button type="button" onClick={() => setShowPw(v=>!v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-soft text-xs">
                      {showPw ? 'إخفاء' : 'إظهار'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-main">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    required
                    className={inputCls}
                  />
                </div>

                {/* مقياس القوة */}
                {password && (
                  <div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-forest-50">
                      <div className={`h-full rounded-full transition-all ${
                        password.length >= 10 ? 'w-full bg-accent' :
                        password.length >= 8  ? 'w-3/4 bg-primary' :
                        password.length >= 6  ? 'w-1/2 bg-sand'   : 'w-1/4 bg-danger'
                      }`} />
                    </div>
                    <p className={`text-[11px] mt-1 ${password.length >= 8 ? 'text-accent' : 'text-text-soft'}`}>
                      {password.length >= 10 ? 'ممتازة' : password.length >= 8 ? 'جيدة' : password.length >= 6 ? 'مقبولة' : 'ضعيفة'}
                    </p>
                  </div>
                )}

                <button type="submit" disabled={loading || !token}
                  className="w-full rounded-2xl bg-primary py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60 transition">
                  {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-xs text-text-soft hover:text-primary">← العودة لتسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
