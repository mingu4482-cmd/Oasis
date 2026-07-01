import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RegisteredUser, UserRole } from '../types/domain';

interface AuthState {
  currentUser: RegisteredUser | null;
  registerUser: (user: RegisteredUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      registerUser: (user) => set({ currentUser: user }),
      clearUser: () => set({ currentUser: null }),
    }),
    {
      name: 'oasis-user',
    },
  ),
);

export function canAccessPath(role: UserRole | null, path: string) {
  if (role === 'ADMIN') {
    return true;
  }

  return ['/map', '/risk-analysis', '/signup', '/login'].some((allowedPath) => path.startsWith(allowedPath));
}
