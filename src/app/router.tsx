import { Navigate, RouteObject } from 'react-router-dom';
import { AlertCenterPage } from '../pages/AlertCenter/AlertCenterPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { DigitalTwinPage } from '../pages/DigitalTwin/DigitalTwinPage';
import { MapViewPage } from '../pages/MapView/MapViewPage';
import { ReportsPage } from '../pages/Reports/ReportsPage';
import { SafeRoutePage } from '../pages/SafeRoute/SafeRoutePage';
import { SignupPage } from '../pages/Signup/SignupPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { RoleGuard } from '../shared/components/RoleGuard';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', element: <RoleGuard><DashboardPage /></RoleGuard> },
  { path: '/map', element: <RoleGuard><MapViewPage /></RoleGuard> },
  { path: '/digital-twin', element: <RoleGuard><DigitalTwinPage /></RoleGuard> },
  { path: '/alerts', element: <RoleGuard><AlertCenterPage /></RoleGuard> },
  { path: '/reports', element: <RoleGuard><ReportsPage /></RoleGuard> },
  { path: '/safe-route', element: <RoleGuard><SafeRoutePage /></RoleGuard> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
];
