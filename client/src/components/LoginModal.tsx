import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  if (!isOpen) return null;

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
      onClose();
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'login' ? '登录' : '注册'}</h2>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={20} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        <p className="modal-switch">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
        <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
