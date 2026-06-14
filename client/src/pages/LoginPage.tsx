import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.scrollTo({ top: 0, left: 0 });
      navigate('/map');
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (!showLogin) {
    return (
      <div className="login-splash-page">
        <div className="login-splash-overlay" />
        <div className="login-splash-content">
          <div className="login-splash-brand">
            <img
              className="login-splash-logo"
              src="/images/shijie-logo-transparent.png"
              alt="识界 Light your life"
            />
          </div>
          <div className="login-splash-action">
            <button className="login-splash-button" onClick={() => setShowLogin(true)}>
              <span>即刻点亮</span>
              <span className="login-splash-star" aria-hidden="true">✦</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-auth-page">
      <section className="login-auth-brand">
        <BrandLogo className="login-auth-logo" />
        <div className="login-auth-brand-text">
          <div className="login-auth-brand-name">识界</div>
          <div className="login-auth-brand-tagline">Light your life</div>
        </div>
      </section>

      <div className="login-auth-card">
        {error && <div className="login-auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-auth-form">
          <div className="login-auth-field">
            <User className="login-auth-field-icon" size={18} aria-hidden="true" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
              minLength={3}
              maxLength={20}
            />
          </div>
          <div className="login-auth-field">
            <Lock className="login-auth-field-icon" size={18} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? '请输入密码' : '设置6-20位密码'}
              required
              minLength={6}
              maxLength={20}
            />
            <button
              type="button"
              className="login-auth-field-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          <button type="submit" className="login-auth-submit" disabled={loading}>
            {loading ? '请稍候...' : mode === 'login' ? '登 录' : '注 册'}
          </button>

          {mode === 'login' && (
            <div className="login-auth-actions">
              <button type="button" className="login-auth-link" onClick={() => { setMode('register'); setError(''); }}>
                立即注册
              </button>
              <button type="button" className="login-auth-link" onClick={() => setError('敬请期待')}>
                忘记密码？
              </button>
            </div>
          )}
        </form>

        <div className="login-auth-footer">
          {mode === 'register' && (
            <>
              <span>已有账号？</span>
              <button className="login-auth-link" onClick={() => { setMode('login'); setError(''); }}>
                去登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img className={className} src="/images/shijie-logo-mark.png" alt="识界" />
  );
}
