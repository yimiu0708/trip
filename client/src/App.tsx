import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RecallProvider } from './context/RecallContext';
import Navbar from './components/Navbar';
import RecallLayout from './components/RecallLayout';
import './App.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ProvincePage = lazy(() => import('./pages/ProvincePage'));
const CityAttractionsPage = lazy(() => import('./pages/CityAttractionsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const JourneyPage = lazy(() => import('./pages/JourneyPage'));
const AchievementPage = lazy(() => import('./pages/AchievementPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const RecallIntroPage = lazy(() => import('./pages/RecallIntroPage'));
const RecallCityPage = lazy(() => import('./pages/RecallCityPage'));
const RecallConfirmPage = lazy(() => import('./pages/RecallConfirmPage'));
const RecallResultPage = lazy(() => import('./pages/RecallResultPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: ReactNode }) {
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
      <Route path="/province/:id/cities/:cityId" element={<RequireAuth><CityAttractionsPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/journeys" element={<RequireAuth><JourneyPage /></RequireAuth>} />
      <Route path="/achievements" element={<RequireAuth><AchievementPage /></RequireAuth>} />
      <Route path="/recall" element={<RequireAuth><RecallLayout /></RequireAuth>}>
        <Route index element={<RecallIntroPage />} />
        <Route path="cities" element={<RecallCityPage />} />
        <Route path="confirm" element={<RecallConfirmPage />} />
        <Route path="result" element={<RecallResultPage />} />
      </Route>
      <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RecallProvider>
          <div className="app">
            <Navbar />
            <main className="app-main">
              <Suspense fallback={<div className="page-loading">加载中...</div>}>
                <AppRoutes />
              </Suspense>
            </main>
          </div>
        </RecallProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
