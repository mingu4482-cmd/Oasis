import {
  Activity,
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  LogIn,
  LogOut,
  Menu,
  Route,
  UserPlus,
  X,
} from 'lucide-react';
import { PropsWithChildren, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/authApi';
import { useRealtimeClock } from '../hooks/useRealtimeClock';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/domain';

type NavItem = { to: string; label: string; icon: typeof Home; roles: Array<UserRole | 'GUEST'> };
type NavGroup = { id: string; label: string; icon: typeof Home; items: NavItem[] };

const homeNavItem: NavItem = { to: '/dashboard', label: '홈', icon: Home, roles: ['GUEST', 'USER', 'ADMIN'] };

const navGroups: NavGroup[] = [
  {
    id: 'monitoring',
    label: '모니터링',
    icon: Activity,
    items: [
      { to: '/risk-analysis', label: 'AI 위험도 분석', icon: Activity, roles: ['GUEST', 'USER', 'ADMIN'] },
    ],
  },
  {
    id: 'response',
    label: '대응',
    icon: Bell,
    items: [
      { to: '/alerts', label: '경보 관리', icon: Bell, roles: ['ADMIN'] },
      { to: '/safe-route', label: '안전 경로', icon: Route, roles: ['GUEST', 'USER', 'ADMIN'] },
    ],
  },
  {
    id: 'operations',
    label: '운영',
    icon: FileText,
    items: [{ to: '/reports', label: '보고서', icon: FileText, roles: ['ADMIN'] }],
  },
];

const isPathActive = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

export function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const now = useRealtimeClock();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const activeRole = currentUser?.role ?? 'GUEST';
  const showHomeNavItem = homeNavItem.roles.includes(activeRole);
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(activeRole)),
    }))
    .filter((group) => group.items.length > 0);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

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
          {showHomeNavItem ? (
            <NavLink to={homeNavItem.to} className="nav-item nav-item-home" onClick={() => setIsMenuOpen(false)}>
              <Home size={18} aria-hidden="true" />
              <span>{homeNavItem.label}</span>
            </NavLink>
          ) : null}
          <div className="nav-group-list">
            {visibleNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const hasActiveChild = group.items.some((item) => isPathActive(location.pathname, item.to));
              const isExpanded = hasActiveChild || (openGroups[group.id] ?? false);
              return (
                <section className={hasActiveChild ? 'nav-group active' : 'nav-group'} key={group.id}>
                  <button
                    type="button"
                    className="nav-group-trigger"
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <GroupIcon size={17} aria-hidden="true" />
                    <span>{group.label}</span>
                    {isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                  </button>
                  {isExpanded ? (
                    <div className="nav-submenu">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink key={item.to} to={item.to} className="nav-item nav-subitem" onClick={() => setIsMenuOpen(false)}>
                            <Icon size={16} aria-hidden="true" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
