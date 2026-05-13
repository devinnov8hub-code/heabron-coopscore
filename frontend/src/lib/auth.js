import { create } from 'zustand';
import api, { clearTokens, setTokens } from './api';

const ADMIN_ROLES = ['super_admin', 'ops_admin', 'finance_admin'];
const PARTNER_ROLES = ['partner_admin', 'partner_analyst'];

const initial = {
  user: null,
  partner: null,
  loading: true,
  isAdmin: false,
  isPartner: false,
  mustChangePassword: false,
};

export const useAuth = create((set, get) => ({
  ...initial,

  /** Resolve the current user from /auth/me using the stored token */
  hydrate: async () => {
    try {
      const data = await api.get('/auth/me', { silentError: true });
      set({
        user: data.user,
        partner: data.partner || null,
        isAdmin: ADMIN_ROLES.includes(data.user?.role),
        isPartner: PARTNER_ROLES.includes(data.user?.role),
        mustChangePassword: !!data.user?.mustChangePassword,
        loading: false,
      });
    } catch {
      clearTokens();
      set({ ...initial, loading: false });
    }
  },

  login: async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setTokens(data);
    set({
      user: data.user,
      partner: data.partner || null,
      isAdmin: ADMIN_ROLES.includes(data.user?.role),
      isPartner: PARTNER_ROLES.includes(data.user?.role),
      mustChangePassword: !!data.user?.mustChangePassword,
      loading: false,
    });
    return data;
  },

  logout: async () => {
    try { await api.post('/auth/logout', {}, { silentError: true }); } catch {}
    clearTokens();
    set({ ...initial, loading: false });
  },

  refreshMe: async () => {
    const data = await api.get('/auth/me');
    set({
      user: data.user,
      partner: data.partner || null,
      mustChangePassword: !!data.user?.mustChangePassword,
    });
  },
}));

export { ADMIN_ROLES, PARTNER_ROLES };
