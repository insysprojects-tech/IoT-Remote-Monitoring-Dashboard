import { create } from 'zustand';

// Helper to check if token exists and isn't expired
const getInitialAuth = () => {
  const token = localStorage.getItem('token');
  if (!token) return { token: null, user: null, isAuthenticated: false };
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Check expiration (exp is in seconds)
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return { token: null, user: null, isAuthenticated: false };
    }
    return { token, user: { username: payload.sub, role: payload.role }, isAuthenticated: true };
  } catch (e) {
    return { token: null, user: null, isAuthenticated: false };
  }
};

export const useAuthStore = create((set) => ({
  ...getInitialAuth(),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Invalid username or password');
      }

      const data = await res.json();
      const token = data.access_token;
      localStorage.setItem('token', token);
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      set({ 
        token, 
        user: { username: payload.sub, role: payload.role }, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));
