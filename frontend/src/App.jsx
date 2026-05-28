import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Login      from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Register   from "./pages/Register";
import VerifyOTP  from "./pages/VerifyOTP";
import Dashboard  from "./pages/Dashboard";
import Upload     from "./pages/Upload";
import Result     from "./pages/Result";
import NotFound   from "./pages/NotFound";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"            element={<Navigate to="/login" />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/register"    element={<Register />} />
        <Route path="/verify-otp"  element={<VerifyOTP />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload"      element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/result/:id"  element={<ProtectedRoute><Result /></ProtectedRoute>} />

        {/* 404 — catch all unknown routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
