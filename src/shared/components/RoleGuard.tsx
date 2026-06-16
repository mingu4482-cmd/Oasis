import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPath, useAuthStore } from '../store/authStore';

interface RoleGuardProps {
  children: JSX.Element;
}

export function RoleGuard({ children }: RoleGuardProps) {
  const location = useLocation();
  const role = useAuthStore((state) => state.currentUser?.role ?? null);

  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
