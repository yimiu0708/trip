import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Globe, Map, Mountain, Camera, Eye, EyeOff, User, Lock, MessageCircle, Apple, AtSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agreed) {
      setError('请阅读并同意《用户协议》和《隐私政策》');
      return;
    }
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
      <div className="splash-page">
        <div className="splash-overlay" />
        <div className="splash-content">
          <div className="splash-quote">
            每一次出发<br />
            都是点亮世界的光
          </div>
          <div className="splash-brand">
            <BrandLogo className="splash-logo" />
            <div className="splash-brand-name">识界</div>
            <div className="splash-brand-script">Light your life</div>
          </div>
          <div className="splash-loader-block">
            <button className="splash-start-btn" onClick={() => setShowLogin(true)}>
              开始探索
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <Plane className="auth-bg-circle circle-1" aria-hidden="true" />
        <Globe className="auth-bg-circle circle-2" aria-hidden="true" />
        <Map className="auth-bg-circle circle-3" aria-hidden="true" />
        <Mountain className="auth-bg-circle circle-4" aria-hidden="true" />
        <Camera className="auth-bg-circle circle-5" aria-hidden="true" />
        <div className="auth-coast" aria-hidden="true" />
      </div>

      <section className="auth-brand-panel">
        <BrandLogo className="auth-brand-icon" />
        <div className="auth-brand-text">
          <div className="auth-brand-name">识界</div>
          <div className="auth-brand-script">Light your life</div>
        </div>
      </section>

      <div className="auth-card">
        <div className="auth-header">
          <h1>{mode === 'login' ? '欢迎回来' : '创建账号'}</h1>
          <p>{mode === 'login' ? '登录开启你的探索之旅' : '注册开启你的探索之旅'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <User className="auth-field-icon" size={18} aria-hidden="true" />
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
          <div className="auth-field">
            <Lock className="auth-field-icon" size={18} aria-hidden="true" />
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
              className="auth-field-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {mode === 'login' && (
            <div className="auth-actions-row">
              <button type="button" className="auth-link" onClick={() => { setMode('register'); setError(''); }}>
                立即注册
              </button>
              <button type="button" className="auth-link" onClick={() => setError('敬请期待')}>
                忘记密码？
              </button>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '请稍候...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="auth-divider"><span>或使用其他方式登录</span></div>
            <div className="auth-social">
              <button type="button" className="auth-social-btn wechat" aria-label="微信登录" onClick={() => setError('敬请期待')}>
                <MessageCircle size={18} fill="currentColor" aria-hidden="true" />
              </button>
              <button type="button" className="auth-social-btn apple" aria-label="Apple 登录" onClick={() => setError('敬请期待')}>
                <Apple size={18} aria-hidden="true" />
              </button>
              <button type="button" className="auth-social-btn qq" aria-label="QQ 登录" onClick={() => setError('敬请期待')}>
                <AtSign size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        <label className="auth-agreement">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="auth-checkmark" />
          <span>我已阅读并同意<a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>《用户协议》</a>和<a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>《隐私政策》</a></span>
        </label>

        <div className="auth-footer">
          {mode === 'register' && (
            <>
              <span>已有账号？</span>
              <button className="auth-link" onClick={() => { setMode('login'); setError(''); }}>
                去登录
              </button>
            </>
          )}
        </div>

        {mode === 'login' && (
          <div className="auth-guest">
            <Link to="/map" className="auth-guest-link">暂不登录，先逛逛</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <img className={`brand-logo-image ${className}`} src="/images/shijie-logo-mark.png" alt="识界" />
  );
}
