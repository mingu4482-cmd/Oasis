import { Navigate, RouteObject, Outlet } from 'react-router-dom';
import { AlertCenterPage } from '../pages/AlertCenter/AlertCenterPage';
import { ReportsPage } from '../pages/Reports/ReportsPage';
import { RiskAnalysisPage } from '../pages/RiskAnalysis/RiskAnalysisPage';
import { SimulationPage } from '../pages/Simulation/SimulationPage';
import { SignupPage } from '../pages/Signup/SignupPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { MapViewPage } from '../pages/MapView/MapViewPage';
import { RoleGuard } from '../shared/components/RoleGuard';
import { AppShell } from '../shared/components/AppShell';

export const routes: RouteObject[] = [
  {
    path: '/',
    // 🌟 모든 메인 페이지를 AppShell 껍데기로 감싸기
    element: (
      <AppShell>
        <Outlet /> 
      </AppShell>
    ),
    children: [
      { index: true, element: <Navigate to="/map" replace /> },
      // 🌟 팀원이 추가한 RoleGuard 와 동생이 추가한 SimulationPage 모두 병합!
      { path: 'map', element: <RoleGuard><MapViewPage /></RoleGuard> },
      { path: 'dashboard', element: <Navigate to="/map" replace /> },
      { path: 'digital-twin', element: <Navigate to="/map" replace /> },
      { path: 'risk-analysis', element: <RoleGuard><RiskAnalysisPage /></RoleGuard> },
      { path: 'alerts', element: <RoleGuard><AlertCenterPage /></RoleGuard> },
      { path: 'reports', element: <RoleGuard><ReportsPage /></RoleGuard> },
      { path: 'safe-route', element: <Navigate to="/map" replace /> },
      { path: 'simulation', element: <SimulationPage/> },
    ],
  },
  // 🌟 로그인/회원가입은 메뉴바(AppShell) 밖에서 렌더링되도록 분리!
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
];
