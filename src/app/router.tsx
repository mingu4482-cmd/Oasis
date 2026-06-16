import { Navigate, RouteObject } from 'react-router-dom';
import { AlertCenterPage } from '../pages/AlertCenter/AlertCenterPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { DigitalTwinPage } from '../pages/DigitalTwin/DigitalTwinPage';
import { MapViewPage } from '../pages/MapView/MapViewPage';
import { ReportsPage } from '../pages/Reports/ReportsPage';
import { SafeRoutePage } from '../pages/SafeRoute/SafeRoutePage';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/map', element: <MapViewPage /> },
  { path: '/digital-twin', element: <DigitalTwinPage /> },
  { path: '/alerts', element: <AlertCenterPage /> },
  { path: '/reports', element: <ReportsPage /> },
  { path: '/safe-route', element: <SafeRoutePage /> },
];
