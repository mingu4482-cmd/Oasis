import {
  AlertTriangle,
  Bell,
  FileText,
  Home,
  Map,
  Menu,
  Route,
  Satellite,
  ShieldCheck,
  X,
} from 'lucide-react';
import { PropsWithChildren, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useRealtimeClock } from '../hooks/useRealtimeClock';
import { useDashboardStore } from '../store/dashboardStore';

const navItems = [
  { to: '/dashboard', label: '홈', icon: Home },
  { to: '/map', label: '통합 지도', icon: Map },
  { to: '/digital-twin', label: '디지털 트윈', icon: Satellite },
  { to: '/alerts', label: '경보 관리', icon: Bell },
  { to: '/reports', label: '보고서', icon: FileText },
  { to: '/safe-route', label: '안전 경로', icon: Route },
];

export function AppShell({ children }: PropsWithChildren) {
  const alertLevel = useDashboardStore((state) => state.alertLevel);
  const now = useRealtimeClock();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            <ShieldCheck size={22} aria-hidden="true" />
            <span>OASIS</span>
          </div>
        </div>
        <div className="topbar-status">
          <span className={`alert-badge alert-${alertLevel.toLowerCase()}`}>
            <AlertTriangle size={16} aria-hidden="true" />
            {alertLevel}
          </span>
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
          {navItems.map((item) => {
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
