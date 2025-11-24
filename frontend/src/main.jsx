// frontend/src/main.jsx
import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/authContext/AuthContext';
import './index.css';
import App from './App.jsx';
import SessionPage from './pages/SessionPage.jsx';
import Landingpage from './pages/Landingpage.jsx';
import LoginPage from './pages/LoginPage.jsx';

// 💥 1. IMPORT THE NEW PAGES
import ScenariosPage from './pages/ScenariosPage.jsx';
import ObjectivePage from './pages/ObjectivePage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import Dashboard from './components/Dashboard.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Landingpage />,
      },
      {
        path: '/session',
        element: <SessionPage />,
      },
      {
        path: '/summary',
        element: <Dashboard />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      // 💥 2. ADD THE NEW ROUTES
      {
        path: '/scenarios',
        element: <ScenariosPage />,
      },
      {
        path: '/objective',
        element: <ObjectivePage />,
      },
      {
        path: '/about',
        element: <AboutPage />,
      },
    ],
  },
]);

// ... (rest of your file is the same) ...
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);