import { Outlet } from 'react-router-dom';
import Menu from './Menu.jsx';

export default function Layout() {
  return (
    <div className="app">
      <Menu />
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  );
}
