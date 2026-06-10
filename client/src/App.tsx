import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProvincePage from './pages/ProvincePage';
import ProfilePage from './pages/ProfilePage';
import JourneyPage from './pages/JourneyPage';
import AchievementPage from './pages/AchievementPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中...</div>;
  if (user) return <Navigate to="/map" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/map" element={<HomePage />} />
      <Route path="/province/:id" element={<RequireAuth><ProvincePage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/journeys" element={<RequireAuth><JourneyPage /></RequireAuth>} />
      <Route path="/achievements" element={<RequireAuth><AchievementPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Navbar />
          <main className="app-main">
            <AppRoutes />
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
