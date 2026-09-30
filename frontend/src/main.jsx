import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AuthProvider from './composants/AuthProvider.jsx';
import TempsReelProvider from './composants/TempsReelProvider.jsx';
import Router from './routes/Router.jsx';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TempsReelProvider>
          <Router />
        </TempsReelProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
