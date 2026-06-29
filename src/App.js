import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import HomePage from './pages/HomePage';
import DrugDetailPage from './pages/DrugDetailPage';
import BrowsePage from './pages/BrowsePage';
import AdminPage from './pages/AdminPage';
import UploadPage from './pages/UploadPage';
import LoginPage from './pages/LoginPage';
import LabReferencePage from './pages/LabReferencePage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public routes ───────────────────────────────────────────── */}
        <Route path="/"                  element={<Layout><HomePage /></Layout>} />
        <Route path="/drug/:id"          element={<Layout><DrugDetailPage /></Layout>} />
        <Route path="/browse"            element={<Layout><BrowsePage /></Layout>} />
        <Route path="/browse/:condition" element={<Layout><BrowsePage /></Layout>} />
        <Route path="/labs"                  element={<Layout><LabReferencePage /></Layout>} />

        {/* ── Admin login (public) ─────────────────────────────────────── */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* ── Protected admin routes ───────────────────────────────────── */}
        <Route path="/admin" element={
          <ProtectedAdminRoute>
            <AdminLayout><AdminPage /></AdminLayout>
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/upload" element={
          <ProtectedAdminRoute>
            <AdminLayout><UploadPage /></AdminLayout>
          </ProtectedAdminRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
