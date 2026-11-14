// ======================================================================
// التقارير الميدانية — لكل المستخدمين
// ----------------------------------------------------------------------
// يطّلع الزملاء على ملاحظات من كتب التقرير فيتلافونها في دوراتهم،
// ويعلّقون عليها. والتقرير بعد إرساله أرشيف لا يُعدَّل.
// ======================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { NotebookPen, MessageCircle, Search, Send, Trash2, Printer, Users, CalendarDays, MapPin, Paperclip } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import Avatar from '../components/shared/Avatar';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { useTranslation } from '../lib/i18n';

const unwrap = (res) => res?.data?.data ?? res?.data;

const PRIORITY_CLS = {
  urgent: 'bg-burgundy/10 text-danger',
  medium: 'bg-sand/20 text-warning',
  low: 'bg-forest-50 text-primary',
};

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
}
function fmtDateTime(v) {
  return v ? new Date(v).toLocaleString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
}
const fullName = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

export default function FieldReportsPage() {
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(unwrap(await api.get('/field-reports')) || []);
    } catch {
      toast.error('تعذّر تحميل التقارير الميدانية');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  // التقرير المختار: من الرابط (شريط الأخبار والإشعار) أو أحدث تقرير
  useEffect(() => {
    if (!items.length) return;
    const fromUrl = typeof router.query.id === 'string' ? router.query.id : null;
    setSelectedId((cur) => cur || (fromUrl && items.some((i) => i.id === fromUrl) ? fromUrl : items[0].id));
  }, [items, router.query.id]);

  const openDetail = useCallback(async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      setDetail(unwrap(await api.get(`/field-reports/${id}`)));
    } catch {
      toast.error('تعذّر فتح التقرير');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => { openDetail(selectedId); }, [selectedId, openDetail]);

  const shown = useMemo(() => {
    const q = search.trim();
    if (!q) return items;
    return items.filter((i) =>
      [i.course?.name, fullName(i.author), i.formData?.notes].some((v) => String(v || '').includes(q)));
  }, [items, search]);

  const postComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    try {
      const c = unwrap(await api.post(`/field-reports/${detail.id}/comments`, { content: text }));
      setDetail((d) => ({ ...d, comments: [...(d.comments || []), c] }));
      setItems((list) => list.map((i) => (i.id === detail.id ? { ...i, commentsCount: (i.commentsCount || 0) + 1 } : i)));
      setComment('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر إرسال التعليق');
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (cid) => {
    try {
      await api.delete(`/field-reports/comments/${cid}`);
      setDetail((d) => ({ ...d, comments: d.comments.filter((c) => c.id !== cid) }));
      setItems((list) => list.map((i) => (i.id === detail.id ? { ...i, commentsCount: Math.max(0, (i.commentsCount || 1) - 1) } : i)));
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر حذف التعليق');
    }
  };

  // طباعة التقرير بهوية الدخول: نافذة جديدة لا تحمل الهوية، فيُجلب ثم يُكتب فيها
  const printReport = async () => {
    try {
      const res = await api.get(`/field-reports/${detail.id}/export`, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) return toast.error('اسمح بالنوافذ المنبثقة');
      w.document.write(typeof res.data === 'string' ? res.data : String(res.data));
      w.document.close();
    } catch {
      toast.error('تعذّر فتح التقرير للطباعة');
    }
  };

  const fd = detail?.formData || {};

  return (
    <MainLayout breadcrumb={[{ label: 'التقارير الميدانية' }]}>
      <div className="space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-text-main">
            <NotebookPen size={22} aria-hidden="true" className="text-primary" /> التقارير الميدانية
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-forest-50 px-2 text-sm text-primary">{items.length}</span>
          </h1>
          <p className="mt-1 text-sm text-text-soft">ملاحظات الزملاء من الميدان — اطّلع عليها لتتلافاها في دوراتك، وشارك برأيك.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : items.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-border bg-white py-12 text-center text-sm text-text-soft">لا تقارير ميدانية بعد.</p>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {/* ── القائمة ── */}
            <section aria-label="قائمة التقارير" className="space-y-3">
              <label className="relative block">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-soft" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالدورة أو الكاتب أو الملاحظة"
                  aria-label="بحث في التقارير" className="w-full rounded-full border border-border bg-white py-2.5 pe-4 ps-9 text-sm outline-none focus:border-primary" />
              </label>
              {shown.map((r) => {
                const active = r.id === selectedId;
                return (
                  <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
                    className={`block w-full overflow-hidden rounded-[20px] border bg-white p-4 text-start transition ${active ? 'border-primary shadow-[0_0_0_1px_#2E6066]' : 'border-border hover:border-primary/40'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar user={r.author} size={42} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-extrabold text-text-main">{r.course?.name}</p>
                        <p className="text-[12px] text-text-soft">{fullName(r.author)} · {fmtDate(r.createdAt)}</p>
                      </div>
                      {r.commentsCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11px] font-bold text-text-soft">
                          <MessageCircle size={13} aria-hidden="true" /> {r.commentsCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-text-main">{r.formData?.notes}</p>
                    {(r.formData?.category || r.formData?.priority) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.formData?.category && <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold text-primary">{t(`notesForm.categories.${r.formData.category}`)}</span>}
                        {r.formData?.priority && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRIORITY_CLS[r.formData.priority] || 'bg-background text-text-soft'}`}>{t(`notesForm.priorities.${r.formData.priority}`)}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </section>

            {/* ── التقرير المختار وتعليقاته ── */}
            <section aria-label="التقرير" className="lg:sticky lg:top-4">
              {loadingDetail || !detail ? (
                <div className="flex justify-center rounded-[20px] border border-border bg-white py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : (
                <article className="overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_1px_2px_rgba(28,46,48,0.05),0_10px_28px_-16px_rgba(28,46,48,0.22)]">
                  <header className="flex items-start gap-3 border-b border-border px-5 py-4">
                    <Avatar user={detail.author} size={48} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-extrabold leading-snug text-text-main">{detail.course?.name}</h2>
                      <p className="text-[12px] text-text-soft">كتبه {fullName(detail.author)} · {fmtDateTime(detail.createdAt)}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-soft">
                        <span className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden="true" /> {fmtDate(detail.course?.startDate)} ← {fmtDate(detail.course?.endDate)}</span>
                        {detail.course?.city && <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" /> {detail.course.city}</span>}
                        {fd.attendanceCount != null && <span className="inline-flex items-center gap-1"><Users size={13} aria-hidden="true" /> {fd.attendanceCount} حاضراً</span>}
                      </p>
                    </div>
                    <button type="button" onClick={printReport} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                      <Printer size={15} aria-hidden="true" /> طباعة
                    </button>
                  </header>

                  <div className="space-y-4 px-5 py-4">
                    <div>
                      <p className="mb-1 text-xs font-extrabold text-text-soft">الملاحظات</p>
                      <p className="whitespace-pre-wrap text-[14px] leading-loose text-text-main">{fd.notes}</p>
                    </div>
                    {fd.suggestedAction && (
                      <div className="rounded-xl bg-primary-light/50 px-4 py-3">
                        <p className="mb-1 text-xs font-extrabold text-primary">الإجراء المقترح</p>
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-main">{fd.suggestedAction}</p>
                      </div>
                    )}
                    {(fd.beneficiaryEntity || fd.executingPartner || fd.additionalTrainers) && (
                      <dl className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-3">
                        {fd.beneficiaryEntity && <div><dt className="text-text-soft">الجهة المستفيدة</dt><dd className="font-bold text-text-main">{fd.beneficiaryEntity}</dd></div>}
                        {fd.executingPartner && <div><dt className="text-text-soft">الشريك المنفّذ</dt><dd className="font-bold text-text-main">{fd.executingPartner}</dd></div>}
                        {fd.additionalTrainers && <div><dt className="text-text-soft">مدربون إضافيون</dt><dd className="font-bold text-text-main">{fd.additionalTrainers}</dd></div>}
                      </dl>
                    )}
                    {Array.isArray(fd.attachments) && fd.attachments.length > 0 && (
                      <div>
                        <p className="mb-2 inline-flex items-center gap-1 text-xs font-extrabold text-text-soft"><Paperclip size={13} aria-hidden="true" /> المرفقات</p>
                        <div className="flex flex-wrap gap-2">
                          {fd.attachments.map((a, i) => {
                            const src = typeof a === 'string' ? a : a?.dataUrl || a?.url;
                            return src && String(src).startsWith('data:image') ? (
                              <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`مرفق ${i + 1}`} className="h-20 w-20 rounded-xl border border-border object-cover" /></a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── التعليقات ── */}
                  <div className="border-t border-border bg-background px-5 py-4">
                    <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-text-main">
                      <MessageCircle size={16} aria-hidden="true" /> تعليقات الزملاء
                      <span className="text-text-soft">({detail.comments?.length || 0})</span>
                    </p>
                    <ul className="space-y-3">
                      {(detail.comments || []).map((c) => (
                        <li key={c.id} className="flex items-start gap-2.5">
                          <Avatar user={c.author} size={32} />
                          <div className="min-w-0 flex-1 rounded-2xl rounded-ss-sm bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(28,46,48,0.06)]">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-extrabold text-text-main">{fullName(c.author)}</span>
                              <span className="text-[11px] text-text-soft">{fmtDateTime(c.createdAt)}</span>
                              {(c.authorId === user?.id || activeRole === 'MANAGER') && (
                                <button type="button" onClick={() => removeComment(c.id)} aria-label="حذف التعليق" className="ms-auto rounded-full p-1 text-text-soft hover:text-danger">
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-text-main">{c.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-end gap-2">
                      <Avatar user={user} size={32} />
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000}
                        placeholder="أضف تعليقاً أو تجربة مشابهة…" aria-label="تعليقك"
                        className="min-w-0 flex-1 resize-none rounded-2xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
                      <button type="button" onClick={postComment} disabled={posting || !comment.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
                        <Send size={14} aria-hidden="true" /> إرسال
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
