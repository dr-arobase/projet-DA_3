import { Outlet } from 'react-router-dom';
import Menu from './Menu.jsx';
import Notifications from './Notifications.jsx';

export default function Layout() {
  return (
    <div className="app">
      <Menu />
      <main className="contenu">
        <Outlet />
      </main>
      <Notifications />
    </div>
  );
}
