import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DrugDetailPage from './pages/DrugDetailPage';
import BrowsePage from './pages/BrowsePage';
import AdminPage from './pages/AdminPage';
import UploadPage from './pages/UploadPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drug/:id" element={<DrugDetailPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/:condition" element={<BrowsePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/upload" element={<UploadPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
