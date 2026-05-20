// صفحة البحث الشامل
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';

// ── ثوابت ──────────────────────────────────────────────────────────────
const COURSE_STATUS = {
  DRAFT:            { label: 'مسودة',            cls: 'bg-border/60 text-text-soft' },
  PREPARATION:      { label: 'قيد الإعداد',       cls: 'bg-sand/20 text-warning border-sand/40' },
  IN_PROGRESS:      { label: 'قيد التنفيذ',       cls: 'bg-primary-light text-primary' },
  AWAITING_CLOSURE: { label: 'بانتظار الإغلاق',   cls: 'bg-sand/30 text-warning' },
  CLOSED:           { label: 'مغلقة',              cls: 'bg-forest-50 text-accent border-accent/20' },
  ARCHIVED:         { label: 'مؤرشفة',             cls: 'bg-border text-text-soft' },
};

const ROLE_LABEL = {
  EMPLOYEE: 'منسق', PROJECT_SUPERVISOR: 'مشرف', MANAGER: 'مدير', QUALITY_VIEWER: 'جودة',
};

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function highlight(text, q) {
  if (!text || !q) return text || '—';
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/20 text-primary font-bold px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchPage() {
  const router    = useRouter();
  const { activeRole } = useAuth();
  const inputRef  = useRef(null);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const debounce  = useRef(null);

  const isManager = activeRole === 'MANAGER';

  // تركيز تلقائي
  useEffect(() => { inputRef.current?.focus(); }, []);

  // بحث من URL query
  useEffect(() => {
    if (router.query.q && router.query.q !== query) {
      setQuery(router.query.q);
      doSearch(router.query.q);
    }
  }, [router.query.q]);

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults(null); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/search', { params: { q: trimmed, limit: 15 } });
      setResults(res.data);
    } catch {
      setError('تعذر تنفيذ البحث');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    if (val.trim().length < 2) { setResults(null); return; }
    debounce.current = setTimeout(() => doSearch(val), 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounce.current);
    doSearch(query);
    router.replace({ pathname: '/search', query: { q: query } }, undefined, { shallow: true });
  };

  const total     = results ? results.courses.length + results.users.length : 0;
  const hasQuery  = query.trim().length >= 2;

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-4">

        {/* رأس + حقل البحث */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <h1 className="mb-3 text-lg font-extrabold text-primary">🔍 البحث الشامل</h1>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleChange}
              placeholder="ابحث عن دورة أو مستخدم أو مشروع..."
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-main outline-none
                transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              autoComplete="off"
              dir="rtl"
            />
            <button type="submit"
              className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-dark transition disabled:opacity-50"
              disabled={loading || query.trim().length < 2}>
              {loading ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'بحث'
              )}
            </button>
          </form>
          {!hasQuery && (
            <p className="mt-2 text-[11px] text-text-soft/60">أدخل كلمتين على الأقل للبدء</p>
          )}
        </div>

        {/* خطأ */}
        {error && (
          <div className="rounded-2xl border border-danger/20 bg-burgundy/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* جاري البحث */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-12 shadow-card">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* نتائج */}
        {!loading && results && (
          <>
            {/* إجمالي النتائج */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 shadow-card">
              <span className="text-sm text-text-soft">
                نتائج البحث عن <strong className="text-primary">"{results.query}"</strong>
              </span>
              <span className={`text-sm font-extrabold ${total === 0 ? 'text-danger' : 'text-primary'}`}>
                {total === 0 ? 'لا نتائج' : `${total} نتيجة`}
              </span>
            </div>

            {total === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center shadow-card">
                <p className="text-4xl mb-3">🔎</p>
                <p className="text-sm font-bold text-text-main">لا توجد نتائج</p>
                <p className="mt-1 text-xs text-text-soft">جرّب كلمات مختلفة أو تحقق من الإملاء</p>
              </div>
            )}

            {/* نتائج الدورات */}
            {results.courses.length > 0 && (
              <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
                <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                  <h2 className="font-extrabold text-text-main">📚 الدورات التدريبية</h2>
                  <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary">
                    {results.courses.length}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {results.courses.map(c => {
                    const sm = COURSE_STATUS[c.status];
                    return (
                      <Link key={c.id} href={`/courses/${c.id}`}
                        className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-background transition group">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-text-main group-hover:text-primary transition truncate">
                              {highlight(c.name, results.query)}
                            </p>
                            {sm && (
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sm.cls}`}>
                                {sm.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-text-soft">
                            {c.code && <span>{highlight(c.code, results.query)}</span>}
                            {c.operationalProject?.name && <span>· {c.operationalProject.name}</span>}
                            {c.beneficiaryEntity && <span>· {highlight(c.beneficiaryEntity, results.query)}</span>}
                            {c.city && <span>· {highlight(c.city, results.query)}</span>}
                            <span>· {fmt(c.startDate)} ← {fmt(c.endDate)}</span>
                          </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                          className="shrink-0 mt-1 text-text-soft/40 group-hover:text-primary transition">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* نتائج المستخدمين — مدير فقط */}
            {isManager && results.users.length > 0 && (
              <div className="rounded-2xl border border-border bg-white shadow-card overflow-hidden">
                <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                  <h2 className="font-extrabold text-text-main">👥 المستخدمون</h2>
                  <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary">
                    {results.users.length}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {results.users.map(u => (
                    <Link key={u.id} href={`/users/${u.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-background transition group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-extrabold shrink-0">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-text-main group-hover:text-primary transition">
                            {highlight(`${u.firstName} ${u.lastName}`, results.query)}
                          </p>
                          <p className="text-[11px] text-text-soft">
                            {highlight(u.email, results.query)}
                            {u.operationalProject?.name && ` · ${u.operationalProject.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(u.roles || []).map(r => (
                          <span key={r} className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
                            {ROLE_LABEL[r] || r}
                          </span>
                        ))}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                          className="text-text-soft/40 group-hover:text-primary transition">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* حالة ابتدائية */}
        {!loading && !results && !error && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center shadow-card">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm text-text-soft">ابدأ الكتابة للبحث في الدورات والمستخدمين</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
