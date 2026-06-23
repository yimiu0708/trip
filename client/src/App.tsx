import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RecallProvider } from './context/RecallContext';
import Navbar from './components/Navbar';
import RecallLayout from './components/RecallLayout';
import './App.css';
import { useState as useLocalState } from 'react';
import { api } from './api/client';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ProvincePage = lazy(() => import('./pages/ProvincePage'));
const CityAttractionsPage = lazy(() => import('./pages/CityAttractionsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const JourneyPage = lazy(() => import('./pages/JourneyPage'));
const AchievementPage = lazy(() => import('./pages/AchievementPage'));
const RecallCityPage = lazy(() => import('./pages/RecallCityPage'));
const RecallConfirmPage = lazy(() => import('./pages/RecallConfirmPage'));
const RecallResultPage = lazy(() => import('./pages/RecallResultPage'));
const PersonalityTestPage = lazy(() => import('./pages/PersonalityTestPage'));
const PersonalityResultPage = lazy(() => import('./pages/PersonalityResultPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));

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
  const { user, passwordChanged } = useAuth();
  return (
    <>
    <Routes>
      <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/map" element={<HomePage />} />
      <Route path="/province/:id" element={<RequireAuth><ProvincePage /></RequireAuth>} />
      <Route path="/province/:id/cities/:cityId" element={<RequireAuth><CityAttractionsPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/journeys" element={<RequireAuth><JourneyPage /></RequireAuth>} />
      <Route path="/achievements" element={<RequireAuth><AchievementPage /></RequireAuth>} />
      <Route path="/favorites" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
      <Route path="/personality/test" element={<RequireAuth><PersonalityTestPage /></RequireAuth>} />
      <Route path="/personality/result" element={<RequireAuth><PersonalityResultPage /></RequireAuth>} />
      <Route path="/recall" element={<RequireAuth><RecallLayout /></RequireAuth>}>
        <Route index element={<RecallCityPage />} />
        <Route path="cities" element={<RecallCityPage />} />
        <Route path="confirm" element={<RecallConfirmPage />} />
        <Route path="result" element={<RecallResultPage />} />
      </Route>
    </Routes>
    {user?.forcePasswordChange && <ForcePasswordChange onDone={passwordChanged} />}
    </>
  );
}

function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const [oldPassword, setOldPassword] = useLocalState('');
  const [newPassword, setNewPassword] = useLocalState('');
  const [error, setError] = useLocalState('');
  const [saving, setSaving] = useLocalState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 10) return setError('新密码至少 10 位');
    setSaving(true); setError('');
    try { await api.auth.changePassword(oldPassword, newPassword); onDone(); }
    catch (reason: any) { setError(reason.message || '密码修改失败'); }
    finally { setSaving(false); }
  };
  return <div className="force-password-overlay"><form onSubmit={submit} className="force-password-card"><h2>请先修改临时密码</h2><p>管理员已重置你的密码。设置新密码后才能继续使用识界。</p><label>临时密码<input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required /></label><label>新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>{error && <span>{error}</span>}<button disabled={saving}>{saving ? '保存中...' : '保存新密码'}</button></form></div>;
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
