import { createContext, useState, useContext, useEffect } from 'react';
import Router from 'next/router';
import api from '../lib/axios';
import { getDefaultRole } from '../lib/roles';

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
    hydrateSession();
  }, []);

  const hydrateSession = async () => {
    try {
      const storage = getStorageScope();
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
      logout(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe) => {
    const res = await api.post('/auth/login', { email, password });
    const storage = rememberMe ? localStorage : sessionStorage;

    storage.setItem('token', res.data.access_token);

    const defaultRole = getDefaultRole(res.data.user.roles);
    setUser(res.data.user);
    setActiveRole(defaultRole);
    persistUserSession(res.data.user, defaultRole, rememberMe);

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
