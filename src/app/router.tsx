import { Navigate, RouteObject, Outlet } from 'react-router-dom'; // 🌟 Outlet 추가!
import { AlertCenterPage } from '../pages/AlertCenter/AlertCenterPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { DigitalTwinPage } from '../pages/DigitalTwin/DigitalTwinPage';
import { MapViewPage } from '../pages/MapView/MapViewPage';
import { ReportsPage } from '../pages/Reports/ReportsPage';
import { SafeRoutePage } from '../pages/SafeRoute/SafeRoutePage';
import { SimulationPage } from '../pages/Simulation/SimulationPage';

// 🌟 AppShell 불러오기 (파일 위치에 맞게 경로 확인해 줘!)
import { AppShell } from '../shared/components/AppShell'; 
// (만약 shared/components 안에 있다면 '../shared/components/AppShell' 로 수정!)

export const routes: RouteObject[] = [
  {
    path: '/',
    // 🌟 1. 모든 페이지를 AppShell 껍데기로 감싸기!
    // AppShell 안의 {children} 자리에 <Outlet />(자식 페이지)이 들어가게 됨
    element: (
      <AppShell>
        <Outlet /> 
      </AppShell>
    ),
    // 🌟 2. 기존 페이지들을 children 배열 안으로 이사시키기
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> }, // 기본 경로는 dashboard로
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'map', element: <MapViewPage /> },
      { path: 'digital-twin', element: <DigitalTwinPage /> },
      { path: 'alerts', element: <AlertCenterPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'safe-route', element: <SafeRoutePage /> },
      { path: 'simulation', element: <SimulationPage /> },
    ],
  },
];