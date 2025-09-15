// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'
// import { createBrowserRouter, RouterProvider } from 'react-router-dom'
// import SessionPage from './pages/SessionPage.jsx'
// import Landingpage from './pages/Landingpage.jsx'
// import LoginPage from './pages/LoginPage.jsx'
// import Summarypage from './pages/Summarypage.jsx'

// const root = createBrowserRouter([
//   {
//     path: '/',
//     element: <App />,
//     children: [
//       {
//         path: '/',
//         element: <Landingpage />,
//       },
//       {
//         path: '/session',
//         element: <SessionPage />,
//       },
//       {
//         path: '/summary',
//         element: <Summarypage />
//       },
//       {
//         path: '/login',
//         element: <LoginPage />,
//       },
//     ]
//   }
// ])

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <RouterProvider router={root} />
//   </StrictMode>,
// )

// src/main.jsx
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
import Summarypage from './pages/Summarypage.jsx';

// 1. Define your routes using createBrowserRouter
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
        element: <Summarypage />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
]);

// 2. Render your application with AuthProvider and RouterProvider
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);