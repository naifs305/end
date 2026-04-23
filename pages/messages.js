import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';

function getDisplayName(person) {
  if (!person) return '-';
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || person.email || '-';
}

function getRoleLabel(roles = []) {
  if (roles.includes('MANAGER')) return 'مدير';
  if (roles.includes('PROJECT_SUPERVISOR')) return 'مشرف مشروع';
  if (roles.includes('QUALITY_VIEWER')) return 'جودة';
  if (roles.includes('EMPLOYEE')) return 'موظف';
  return 'مستخدم';
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return value;
  }
}

export default function MessagesPage() {
  const { activeRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');

  const loadPage = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, conversationsRes] = await Promise.all([
        api.get('/messages/users'),
        api.get('/messages/conversations'),
      ]);
      setUsers(usersRes.data || []);
      const list = conversationsRes.data || [];
      setConversations(list);
      setSelectedUserId((prev) => prev || list[0]?.user?.id || usersRes.data?.[0]?.id || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'فشل تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (userId) => {
    if (!userId) {
      setThread([]);
      return;
    }
    try {
      setThreadLoading(true);
      const res = await api.get(`/messages/thread/${userId}`);
      setThread(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'فشل تحميل المحادثة');
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (!activeRole) return;
    loadPage();
  }, [activeRole]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadThread(selectedUserId);
  }, [selectedUserId]);

  const userMap = useMemo(() => {
    const map = new Map();
    for (const user of users) map.set(user.id, user);
    for (const item of conversations) if (item.user?.id) map.set(item.user.id, item.user);
    return map;
  }, [users, conversations]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    for (const item of users.map((user) => ({ user, unreadCount: 0, lastMessage: null, updatedAt: null }))) map.set(item.user.id, item);
    for (const item of conversations) map.set(item.user.id, { ...(map.get(item.user.id) || {}), ...item });
    const base = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (!q) return base;

    return base.filter((item) => {
      const name = getDisplayName(item.user).toLowerCase();
      const email = (item.user?.email || '').toLowerCase();
      const project = (item.user?.operationalProject?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || project.includes(q);
    });
  }, [conversations, users, search]);

  const selectedUser = selectedUserId ? userMap.get(selectedUserId) : null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !messageText.trim()) return;

    try {
      setSending(true);
      setError('');
      await api.post('/messages', {
        recipientIds: [selectedUserId],
        message: messageText.trim(),
        subject: 'محادثة داخلية',
      });
      setMessageText('');
      await Promise.all([loadPage(), loadThread(selectedUserId)]);
    } catch (err) {
      setError(err?.response?.data?.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout title="المراسلات الداخلية">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 h-[calc(100vh-180px)]">
        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">المحادثات</h1>
              <p className="text-sm text-gray-500">دردشة داخلية بين المستخدمين</p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="ابحث عن مستخدم"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">جاري التحميل...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">لا توجد محادثات حالياً.</div>
            ) : (
              filteredConversations.map((item) => {
                const selected = selectedUserId === item.user?.id;
                return (
                  <button
                    key={item.user?.id}
                    type="button"
                    onClick={() => setSelectedUserId(item.user?.id)}
                    className={`w-full text-right px-4 py-4 border-b border-gray-100 transition ${selected ? 'bg-primary-light' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{getDisplayName(item.user)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getRoleLabel(item.user?.roles || [])}
                          {item.user?.operationalProject?.name ? ` - ${item.user.operationalProject.name}` : ''}
                        </div>
                        <div className="text-sm text-gray-600 mt-2 truncate">
                          {item.lastMessage?.body || 'ابدأ محادثة جديدة'}
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <div className="text-[11px] text-gray-400">{formatDate(item.updatedAt || item.lastMessage?.createdAt)}</div>
                        {item.unreadCount > 0 ? (
                          <div className="mt-2 inline-flex min-w-[24px] h-6 px-2 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                            {item.unreadCount}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selectedUser ? getDisplayName(selectedUser) : 'اختر محادثة'}</h2>
              {selectedUser ? (
                <p className="text-sm text-gray-500">
                  {getRoleLabel(selectedUser.roles || [])}
                  {selectedUser?.operationalProject?.name ? ` - ${selectedUser.operationalProject.name}` : ''}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                loadPage();
                if (selectedUserId) loadThread(selectedUserId);
              }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50"
            >
              تحديث
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 min-h-[320px]">
            {threadLoading ? (
              <div className="text-sm text-gray-500">جاري تحميل المحادثة...</div>
            ) : !selectedUserId ? (
              <div className="text-sm text-gray-500">اختر مستخدمًا لبدء المحادثة.</div>
            ) : thread.length === 0 ? (
              <div className="text-sm text-gray-500">لا توجد رسائل بعد. ابدأ أول رسالة الآن.</div>
            ) : (
              thread.map((item) => (
                <div
                  key={`${item.id}-${item.createdAt}`}
                  className={`flex ${item.direction === 'out' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${item.direction === 'out' ? 'bg-primary text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                    <div className="text-sm whitespace-pre-wrap break-words">{item.body}</div>
                    <div className={`mt-2 text-[11px] ${item.direction === 'out' ? 'text-white/80' : 'text-gray-400'}`}>
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white">
            {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
            <div className="flex items-end gap-3">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder={selectedUserId ? 'اكتب رسالتك هنا' : 'اختر محادثة أولاً'}
                disabled={!selectedUserId || sending}
                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={!selectedUserId || !messageText.trim() || sending}
                className="px-5 py-3 rounded-2xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </MainLayout>
  );
}
