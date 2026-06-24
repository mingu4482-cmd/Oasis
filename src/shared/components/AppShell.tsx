import {
  Activity,
  Bell,
  FileText,
  Home,
  LogIn,
  LogOut,
  Map,
  Menu,
  Route,
  Satellite,
  UserPlus,
  X,
} from 'lucide-react';
import { PropsWithChildren, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../api/authApi';
import { useRealtimeClock } from '../hooks/useRealtimeClock';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/domain';

const navItems: Array<{ to: string; label: string; icon: typeof Home; roles: Array<UserRole | 'GUEST'> }> = [
  { to: '/dashboard', label: '홈', icon: Home, roles: ['GUEST', 'USER', 'ADMIN'] },
  { to: '/map', label: '통합 지도', icon: Map, roles: ['GUEST', 'USER', 'ADMIN'] },
  { to: '/digital-twin', label: '디지털 트윈', icon: Satellite, roles: ['ADMIN'] },
  { to: '/risk-analysis', label: 'AI 위험도 분석', icon: Activity, roles: ['GUEST', 'USER', 'ADMIN'] },
  { to: '/alerts', label: '경보 관리', icon: Bell, roles: ['ADMIN'] },
  { to: '/reports', label: '보고서', icon: FileText, roles: ['ADMIN'] },
  { to: '/safe-route', label: '안전 경로', icon: Route, roles: ['GUEST', 'USER', 'ADMIN'] },
];

export function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const now = useRealtimeClock();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeRole = currentUser?.role ?? 'GUEST';
  const visibleNavItems = navItems.filter((item) => item.roles.includes(activeRole));

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearUser();
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="menu-button"
            type="button"
            aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <div className="brand">
            <span>OASIS</span>
          </div>
        </div>
        <div className="topbar-status">
          {currentUser ? (
            <div className="auth-actions" aria-label="계정 메뉴">
              <span className="role-badge">{currentUser.role === 'ADMIN' ? '관리자' : '일반'}</span>
              <button className="auth-link" type="button" onClick={handleLogout}>
                <LogOut size={15} aria-hidden="true" />
                로그아웃
              </button>
            </div>
          ) : (
            <div className="auth-actions" aria-label="계정 메뉴">
              <Link className="auth-link" to="/login">
                <LogIn size={15} aria-hidden="true" />
                로그인
              </Link>
              <Link className="auth-link primary" to="/signup">
                <UserPlus size={15} aria-hidden="true" />
                회원가입
              </Link>
            </div>
          )}
          <span className="clock">{now.toLocaleTimeString('ko-KR')}</span>
          <button className="icon-button" type="button" aria-label="알림">
            <Bell size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      {isMenuOpen ? (
        <button className="menu-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setIsMenuOpen(false)} />
      ) : null}
      <div className="shell-body">
        <aside className={isMenuOpen ? 'sidebar open' : 'sidebar'} aria-hidden={!isMenuOpen}>
          <div className="sidebar-title">메뉴</div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="nav-item" onClick={() => setIsMenuOpen(false)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
