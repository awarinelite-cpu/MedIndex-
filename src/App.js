import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import HomePage from './pages/HomePage';
import DrugDetailPage from './pages/DrugDetailPage';
import BrowsePage from './pages/BrowsePage';
import AdminPage from './pages/AdminPage';
import UploadPage from './pages/UploadPage';

function App() {
  return (
    <Routes>
      {/* ── Public routes — use public Layout ───────────────────────── */}
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/drug/:id" element={<Layout><DrugDetailPage /></Layout>} />
      <Route path="/browse" element={<Layout><BrowsePage /></Layout>} />
      <Route path="/browse/:condition" element={<Layout><BrowsePage /></Layout>} />

      {/* ── Admin routes — completely separate AdminLayout ───────────── */}
      <Route path="/admin" element={<AdminLayout><AdminPage /></AdminLayout>} />
      <Route path="/admin/upload" element={<AdminLayout><UploadPage /></AdminLayout>} />
    </Routes>
  );
}

export default App;
