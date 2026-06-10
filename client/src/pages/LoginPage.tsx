import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      navigate('/map');
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-circle circle-1">✈️</div>
        <div className="auth-bg-circle circle-2">🌍</div>
        <div className="auth-bg-circle circle-3">🗺️</div>
        <div className="auth-bg-circle circle-4">⛰️</div>
        <div className="auth-bg-circle circle-5">📷</div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🌍</div>
          <h1>旅行足迹</h1>
          <p>用脚步丈量世界，点亮每一段旅程</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>用户名</label>
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
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? '请输入密码' : '设置6-20位密码'}
              required
              minLength={6}
              maxLength={20}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '请稍候...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' ? (
            <>
              <span>还没有账号？</span>
              <button className="auth-link" onClick={() => { setMode('register'); setError(''); }}>
                立即注册
              </button>
            </>
          ) : (
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
            <Link to="/map" className="auth-guest-link">👀 暂不登录，先逛逛</Link>
          </div>
        )}
      </div>
    </div>
  );
}
