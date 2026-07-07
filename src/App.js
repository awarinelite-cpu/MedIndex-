import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AiInsightProvider } from './context/AiInsightContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedUserRoute from './components/ProtectedUserRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import UserAuthPage from './pages/UserAuthPage';
import HomePage from './pages/HomePage';
import DrugDetailPage from './pages/DrugDetailPage';
import AiDrugPage from './pages/AiDrugPage';
import BrowsePage from './pages/BrowsePage';
import DrugListsPage from './pages/DrugListsPage';
import DrugListDetailPage from './pages/DrugListDetailPage';
import AdminPage from './pages/AdminPage';
import AdminUsersPage from './pages/AdminUsersPage';
import UploadPage from './pages/UploadPage';
import LabReferencePage from './pages/LabReferencePage';
import CalculatorsPage from './pages/CalculatorsPage';
import SystemPage from './pages/SystemPage';
import AllSystemsPage from './pages/AllSystemsPage';
import EssentialDrugsPage from './pages/EssentialDrugsPage';
function App() {
  return (
    <AuthProvider>
      <AiInsightProvider>
      <Routes>
{/* ── Auth pages (public — no login required) ──────────────────── */}
        <Route path="/login" element={<UserAuthPage />} />
        <Route path="/labs" element={<Layout><LabReferencePage /></Layout>} />

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
        <Route path="/ai-drug/:name" element={
          <ProtectedUserRoute>
            <Layout><AiDrugPage /></Layout>
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
        <Route path="/systems" element={
          <ProtectedUserRoute>
            <Layout><AllSystemsPage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/system/:systemId" element={
          <ProtectedUserRoute>
            <Layout><SystemPage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/essential-drugs" element={
          <ProtectedUserRoute>
            <Layout><EssentialDrugsPage /></Layout>
          </ProtectedUserRoute>
        } />
        <Route path="/calculators" element={
          <ProtectedUserRoute>
            <Layout><CalculatorsPage /></Layout>
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
        <Route path="/admin/users" element={
          <ProtectedAdminRoute>
            <AdminLayout><AdminUsersPage /></AdminLayout>
          </ProtectedAdminRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
      </AiInsightProvider>
    </AuthProvider>
  );
}

export default App;
