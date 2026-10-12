import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import SelectionPage from "./pages/SelectionPage";
import WordgenerationPage from "./pages/WordgenerationPage";
import DeclarationPage from "./pages/DeclarationPage";
import ConfigurationPage from "./pages/ConfigurationPage";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingPage from "./pages/PendingPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pending" element={<PendingPage />} />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* App existante, protégée */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="/selection" element={<SelectionPage />} />
            <Route path="/word" element={<WordgenerationPage />} />
            {/* <Route path="/declaration" element={<DeclarationPage />} /> */}
            {/* <Route path="/configuration" element={<ConfigurationPage />} /> */}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}