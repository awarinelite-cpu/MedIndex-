import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedUserRoute from './components/ProtectedUserRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import UserAuthPage from './pages/UserAuthPage';
import HomePage from './pages/HomePage';
import DrugDetailPage from './pages/DrugDetailPage';
import BrowsePage from './pages/BrowsePage';
import DrugListsPage from './pages/DrugListsPage';
import DrugListDetailPage from './pages/DrugListDetailPage';
import AdminPage from './pages/AdminPage';
import UploadPage from './pages/UploadPage';

function App() {
  return (
    <AuthProvider>
      <Routes>

        {/* ── Auth pages (public — no login required) ──────────────────── */}
        <Route path="/login" element={<UserAuthPage />} />

        {/* ── User-protected public routes ─────────────────────────────── */}
        <Route path="/" element={
          <ProtectedUserRoute>
            <Layout><HomePage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/drug/:id" element={
          <ProtectedUserRoute>
            <Layout><DrugDetailPage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/browse" element={
          <ProtectedUserRoute>
            <Layout><BrowsePage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/browse/:condition" element={
          <ProtectedUserRoute>
            <Layout><BrowsePage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/lists" element={
          <ProtectedUserRoute>
            <Layout><DrugListsPage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/lists/:listId" element={
          <ProtectedUserRoute>
            <Layout><DrugListDetailPage /></Layout>
          </ProtectedUserRoute>
        } />

        {/* ── Admin-protected routes ────────────────────────────────────── */}
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
