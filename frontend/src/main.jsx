import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AuthProvider from './composants/AuthProvider.jsx';
import TempsReelProvider from './composants/TempsReelProvider.jsx';
import Router from './routes/Router.jsx';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* basename : '/' en local et dans Docker, '/projet-DA_3/' sur GitHub Pages (option --base de Vite) */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <TempsReelProvider>
          <Router />
        </TempsReelProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
