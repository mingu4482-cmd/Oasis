import { useRoutes } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { routes } from './router';

function AppRoutes() {
  return useRoutes(routes);
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
