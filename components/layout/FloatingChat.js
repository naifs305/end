import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';

const POLL_MS = 15000; // تحديث كل 15 ثانية

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)}د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}س`;
  return `${Math.floor(diff / 86400)}ي`;
}

export default function FloatingChat() {
  const { user } = useAuth();
  const router = useRouter();

  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState('list'); // 'list' | 'chat'
  const [contacts, setContacts]   = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [thread, setThread]       = useState([]);
  const [msgText, setMsgText]     = useState('');
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const bottomRef = useRef(null);
  const pollRef   = useRef(null);
  const inputRef  = useRef(null);

  // ── تحميل جهات الاتصال والمحادثات ──
  const loadConvos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [usersRes, convosRes] = await Promise.all([
        api.get('/messages/users'),
        api.get('/messages'),
      ]);
      const users = usersRes.data || [];
      const convList = convosRes.data || [];
      setContacts(users);

      // احسب غير المقروءة — convList كل عنصر { user: {...}, lastMessage: {...}, unreadCount }
      const unreadMap = {};
      const lastMsgMap = {};
      let total = 0;
      for (const c of convList) {
        const uid = c.user?.id;
        if (!uid) continue;
        unreadMap[uid] = c.unreadCount || 0;
        lastMsgMap[uid] = c.lastMessage || null;
        total += c.unreadCount || 0;
      }
      setUnreadTotal(total);

      // ادمج مع قائمة جهات الاتصال
      setContacts(prev => prev.map(u => ({
        ...u,
        unread: unreadMap[u.id] || 0,
        lastMsg: lastMsgMap[u.id] || null,
      })).sort((a, b) => (b.unread - a.unread) || (new Date(b.lastMsg?.createdAt || 0) - new Date(a.lastMsg?.createdAt || 0))));
    } catch {}
  }, [user?.id]);

  // ── تحميل thread + تعليم الوارد كمقروء ──
  const loadThread = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    try {
      // getThread يعلّم الوارد كمقروء تلقائياً على الخادم — لا حاجة لاستدعاء إضافي
      const res = await api.get(`/messages/thread/${uid}`);
      setThread(res.data || []);
    } catch {}
    setLoading(false);
  }, []);

  // ── polling ──
  useEffect(() => {
    loadConvos();
    pollRef.current = setInterval(loadConvos, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadConvos]);

  // تحديث الـ thread كل 10 ثوانٍ عند الفتح
  useEffect(() => {
    if (!open || view !== 'chat' || !activeUser) return;
    const t = setInterval(() => loadThread(activeUser.id), 10000);
    return () => clearInterval(t);
  }, [open, view, activeUser, loadThread]);

  // scroll للآخر
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  // focus على input عند فتح المحادثة
  useEffect(() => {
    if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 100);
  }, [view, activeUser]);

  const openChat = async (contact) => {
    setActiveUser(contact);
    setView('chat');
    setThread([]);
    await loadThread(contact.id);
    // إخفاء فوري للعلامة ثم مزامنة العدّاد الحقيقي من الخادم
    setContacts(prev => prev.map(u => u.id === contact.id ? { ...u, unread: 0 } : u));
    setUnreadTotal(prev => Math.max(0, prev - (contact.unread || 0)));
    await loadConvos();
  };

  const sendMsg = async () => {
    if (!msgText.trim() || !activeUser || sending) return;
    setSending(true);
    const text = msgText.trim();
    setMsgText('');
    try {
      await api.post('/messages', {
        recipientIds: [activeUser.id],
        subject: `رسالة من ${user?.firstName}`,
        message: text,
      });
      await loadThread(activeUser.id);
      await loadConvos();
    } catch {}
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  if (!user) return null;
  // لا تظهر في صفحة المراسلات
  if (router.pathname === '/messages') return null;


  return (
    <>
      {/* زر الدردشة العائم */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) { setView('list'); loadConvos(); } }}
        className="fixed bottom-6 left-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-[0_4px_20px_rgba(0,108,109,0.4)] transition hover:bg-primary-dark hover:scale-105 active:scale-95"
        title="الدردشة الفورية"
      >
        <span className="text-2xl">{open ? '✕' : '💬'}</span>
        {!open && unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-extrabold text-white shadow">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* نافذة الدردشة */}
      {open && (
        <div className="fixed bottom-24 left-6 z-[79] flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)]"
          style={{ width: 320, height: 480 }}>

          {/* الرأس */}
          <div className="flex items-center gap-2 border-b border-border bg-primary px-4 py-3">
            {view === 'chat' && (
              <button onClick={() => setView('list')} className="text-white/70 hover:text-white text-sm ml-1">▶</button>
            )}
            <div className="flex-1 min-w-0">
              {view === 'list' ? (
                <p className="font-extrabold text-white text-sm">💬 الدردشة الفورية</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white text-xs font-extrabold">
                    {activeUser?.firstName?.[0]}{activeUser?.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-white text-xs truncate">{activeUser?.firstName} {activeUser?.lastName}</p>
                    <p className="text-white/60 text-[10px] truncate">{activeUser?.operationalProject?.name || ''}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* قائمة جهات الاتصال */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {contacts.length === 0 && (
                <div className="flex items-center justify-center h-full text-sm text-text-soft">جاري التحميل...</div>
              )}
              {contacts.map(c => (
                <button key={c.id} onClick={() => openChat(c)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-background transition">
                  {/* أفاتار */}
                  <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-extrabold ${c.unread > 0 ? 'bg-primary' : 'bg-text-soft/30'}`}>
                    {c.firstName?.[0]}{c.lastName?.[0]}
                    {c.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-extrabold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${c.unread > 0 ? 'font-extrabold text-text-main' : 'font-bold text-text-main'}`}>
                        {c.firstName} {c.lastName}
                      </p>
                      <span className="text-[10px] text-text-soft shrink-0 mr-1">{timeAgo(c.lastMsg?.createdAt)}</span>
                    </div>
                    <p className="text-[10px] text-text-soft truncate">
                      {c.lastMsg?.body || c.operationalProject?.name || '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* نافذة المحادثة */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-background/30">
                {loading && <div className="text-center text-xs text-text-soft py-4">جاري التحميل...</div>}
                {!loading && thread.length === 0 && (
                  <div className="text-center text-xs text-text-soft py-6">
                    لا توجد رسائل — ابدأ المحادثة!
                  </div>
                )}
                {thread.map((msg, i) => {
                  // الخادم لا يضع senderId في الرسائل الصادرة — نعتمد على direction
                  const isMe = msg.direction === 'out';
                  return (
                    <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-primary text-white rounded-bl-sm'
                          : 'bg-white border border-border text-text-main rounded-br-sm'
                      }`}>
                        <p>{msg.body}</p>
                        <p className={`text-[9px] mt-0.5 ${isMe ? 'text-white/60 text-left' : 'text-text-soft/60 text-right'}`}>
                          {timeAgo(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* حقل الإرسال */}
              <div className="flex items-center gap-2 border-t border-border bg-white px-3 py-2">
                <input
                  ref={inputRef}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="اكتب رسالة..."
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={sendMsg}
                  disabled={!msgText.trim() || sending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-dark transition disabled:opacity-40"
                >
                  {sending ? '⏳' : '◀'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
