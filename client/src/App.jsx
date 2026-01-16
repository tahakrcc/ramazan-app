import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neutral-900 text-white">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/$2a$12$0mpfmkuPmo4iolYNPnlkUu3LhFUkhRW/qQl3Ej.lmgtJFULWY6jbS" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
        <ToastContainer theme="dark" position="bottom-right" />
      </div>
    </Router>
  );
}

export default App;
