import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import { MessageSquare, Search, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

function getDisplayName(person) {
  if (!person) return '-';
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || person.email || '-';
}

function getRoleKey(roles = []) {
  if (roles.includes('MANAGER')) return 'MANAGER';
  if (roles.includes('PROJECT_SUPERVISOR')) return 'PROJECT_SUPERVISOR';
  if (roles.includes('QUALITY_VIEWER')) return 'QUALITY_VIEWER';
  if (roles.includes('EMPLOYEE')) return 'EMPLOYEE';
  return null;
}

export default function MessagesPage() {
  const { activeRole } = useAuth();
  const { t, locale } = useTranslation();
  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';
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

  const roleLabel = (roles = []) => {
    const key = getRoleKey(roles);
    return key ? t(`roles.${key}`) : t('messagesPage.userFallback');
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString(intl);
    } catch {
      return value;
    }
  };

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
      setError(err?.response?.data?.message || t('messagesPage.loadConversationsFailed'));
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
      setError(err?.response?.data?.message || t('messagesPage.loadThreadFailed'));
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
        subject: t('messagesPage.internalSubject'),
      });
      setMessageText('');
      await Promise.all([loadPage(), loadThread(selectedUserId)]);
    } catch (err) {
      setError(err?.response?.data?.message || t('messagesPage.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout title={t('messagesPage.title')}>
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 h-[calc(100vh-180px)]">
        <section className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col shadow-card">
          <div className="p-4 border-b border-border space-y-3">
            <div>
              <h1 className="inline-flex items-center gap-2 text-lg font-extrabold text-primary">
                <MessageSquare size={18} aria-hidden="true" /> {t('messagesPage.conversations')}
              </h1>
              <p className="text-xs text-text-soft mt-0.5">{t('messagesPage.subtitle')}</p>
            </div>
            <div className="relative">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 ps-9 pe-3"
                placeholder={t('messagesPage.searchPlaceholder')}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-text-soft">{t('common.loading')}</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-sm text-text-soft">{t('messagesPage.noConversations')}</div>
            ) : (
              filteredConversations.map((item) => {
                const selected = selectedUserId === item.user?.id;
                return (
                  <button
                    key={item.user?.id}
                    type="button"
                    onClick={() => setSelectedUserId(item.user?.id)}
                    className={`w-full text-start px-4 py-4 border-b border-border transition ${selected ? 'bg-primary-light' : 'bg-white hover:bg-background'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-main truncate">{getDisplayName(item.user)}</div>
                        <div className="text-xs text-text-soft mt-1">
                          {roleLabel(item.user?.roles || [])}
                          {item.user?.operationalProject?.name ? ` - ${item.user.operationalProject.name}` : ''}
                        </div>
                        <div className="text-sm text-text-soft mt-2 truncate">
                          {item.lastMessage?.body || t('messagesPage.startNewConversation')}
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <div className="text-[11px] text-text-soft/60">{formatDate(item.updatedAt || item.lastMessage?.createdAt)}</div>
                        {item.unreadCount > 0 ? (
                          <div className="mt-2 inline-flex min-w-[24px] h-6 px-2 items-center justify-center rounded-full bg-danger text-white text-xs font-bold">
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

        <section className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-card">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-text-main">{selectedUser ? getDisplayName(selectedUser) : t('messagesPage.selectConversation')}</h2>
              {selectedUser ? (
                <p className="text-sm text-text-soft">
                  {roleLabel(selectedUser.roles || [])}
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm hover:bg-background"
            >
              <RefreshCw size={15} aria-hidden="true" /> {t('common.refresh')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background space-y-3 min-h-[320px]">
            {threadLoading ? (
              <div className="text-sm text-text-soft">{t('messagesPage.loadingThread')}</div>
            ) : !selectedUserId ? (
              <div className="text-sm text-text-soft">{t('messagesPage.selectUserToStart')}</div>
            ) : thread.length === 0 ? (
              <div className="text-sm text-text-soft">{t('messagesPage.noMessagesYet')}</div>
            ) : (
              thread.map((item) => (
                <div
                  key={`${item.id}-${item.createdAt}`}
                  className={`flex ${item.direction === 'out' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm ${item.direction === 'out' ? 'bg-primary text-white' : 'bg-white text-text-main border border-border'}`}>
                    <div className="text-sm whitespace-pre-wrap break-words">{item.body}</div>
                    <div className={`mt-2 text-[11px] ${item.direction === 'out' ? 'text-white/80' : 'text-text-soft/60'}`}>
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-border bg-white">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            <div className="flex items-end gap-3">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder={selectedUserId ? t('messagesPage.typeMessage') : t('messagesPage.selectConversationFirst')}
                disabled={!selectedUserId || sending}
                className="flex-1 rounded-2xl border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-background"
              />
              <button
                type="submit"
                disabled={!selectedUserId || !messageText.trim() || sending}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-50 transition"
              >
                {sending
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> {t('messagesPage.sending')}</>
                : <><Send size={16} aria-hidden="true" /> {t('common.submit')}</>}
              </button>
            </div>
          </form>
        </section>
      </div>
    </MainLayout>
  );
}
