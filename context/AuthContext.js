import { createContext, useState, useContext, useEffect } from 'react';
import Router from 'next/router';
import api from '../lib/axios';
import { getDefaultRole } from '../lib/roles';
import { serveSession, borrowSession, isPublicPath } from '../lib/sessionShare';

const AuthContext = createContext({});

function getStorageScope() {
  if (typeof window === 'undefined') return null;

  if (localStorage.getItem('token')) return localStorage;
  if (sessionStorage.getItem('token')) return sessionStorage;
  return null;
}

function persistUserSession(user, role, rememberMe) {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('cachedUser', JSON.stringify(user));
  storage.setItem('activeRole', role);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // تجيب النوافذ الأخرى بجلستها، وتأخذ جلسة غيرها إن فُتحت بلا جلسة
    const stop = serveSession();
    hydrateSession();
    return stop;
  }, []);

  const hydrateSession = async () => {
    try {
      let storage = getStorageScope();
      // نافذة جديدة بلا جلسة (فُتحت من صفحة أخرى): تأخذها من النوافذ المفتوحة
      if (!storage && !isPublicPath() && (await borrowSession())) storage = getStorageScope();
      const token = storage?.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      const cachedRaw = storage.getItem('cachedUser');
      const savedRole = storage.getItem('activeRole');

      if (cachedRaw) {
        try {
          const cachedUser = JSON.parse(cachedRaw);
          setUser(cachedUser);

          const defaultRole = getDefaultRole(cachedUser.roles);
          setActiveRole(savedRole && cachedUser.roles?.includes(savedRole) ? savedRole : defaultRole);
          setLoading(false);
        } catch {
          storage.removeItem('cachedUser');
        }
      }

      const res = await api.get('/users/me');
      const freshUser = res.data;
      const defaultRole = getDefaultRole(freshUser.roles);
      const resolvedRole = savedRole && freshUser.roles?.includes(savedRole) ? savedRole : defaultRole;

      setUser(freshUser);
      setActiveRole(resolvedRole);
      storage.setItem('cachedUser', JSON.stringify(freshUser));
      storage.setItem('activeRole', resolvedRole);
    } catch (error) {
      console.error('Session invalid - AuthContext.js', error);
      // المجلة العامة تُعرض لكل أحد، فلا يُحوَّل زائرها إلى الدخول
      logout(!isPublicPath());
    } finally {
      setLoading(false);
    }
  };

  const startSession = (data, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage;

    storage.setItem('token', data.access_token);

    const defaultRole = getDefaultRole(data.user.roles);
    setUser(data.user);
    setActiveRole(defaultRole);
    persistUserSession(data.user, defaultRole, rememberMe);
  };

  // عند تفعيل التحقق الثنائي يُرجع الخادم { mfaRequired, mfaToken } بلا جلسة
  const login = async (email, password, rememberMe) => {
    const res = await api.post('/auth/login', { email, password });
    if (!res.data.mfaRequired) startSession(res.data, rememberMe);
    return res.data;
  };

  const verifyOtp = async (mfaToken, code, rememberMe) => {
    const res = await api.post('/auth/verify-otp', { mfaToken, code });
    startSession(res.data, rememberMe);
    return res.data;
  };

  const resendOtp = async (mfaToken) => {
    const res = await api.post('/auth/resend-otp', { mfaToken });
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.data.access_token);
    setUser(res.data.user);
    setActiveRole('EMPLOYEE');
    localStorage.setItem('cachedUser', JSON.stringify(res.data.user));
    localStorage.setItem('activeRole', 'EMPLOYEE');
    return res.data;
  };

  const logout = (redirect = true) => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('cachedUser');
    sessionStorage.removeItem('cachedUser');
    localStorage.removeItem('activeRole');
    sessionStorage.removeItem('activeRole');
    setUser(null);
    setActiveRole(null);
    if (redirect) Router.push('/login');
  };

  const switchRole = (role) => {
    if (!user?.roles?.includes(role)) return;

    setActiveRole(role);

    const storage = getStorageScope() || localStorage;
    storage.setItem('activeRole', role);
    Router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        login,
        verifyOtp,
        resendOtp,
        register,
        logout,
        switchRole,
        loading,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default useAuth;
