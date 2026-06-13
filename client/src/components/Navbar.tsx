import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Map, Backpack, Medal, User, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  const isActive = (path: string) => location.pathname === path;

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || newPwd.length < 6) {
      setPwdMsg('密码需6-20位');
      return;
    }
    try {
      await api.auth.changePassword(oldPwd, newPwd);
      setPwdMsg('修改成功');
      setOldPwd('');
      setNewPwd('');
      setTimeout(() => { setShowPwdForm(false); setPwdMsg(''); }, 1500);
    } catch (err: any) {
      setPwdMsg(err.message);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* 顶部标题栏 */}
      <header className="app-header-bar">
        <Link to="/map" className="app-title-link">
          <div className="app-title">
            <span className="app-title-main">识界</span>
            <span className="app-title-sub brand-script">Light your life</span>
          </div>
        </Link>
        <div className="app-header-right">
          <div className="avatar-menu-wrap">
            <button className="avatar-btn" onClick={() => { setMenuOpen(!menuOpen); setShowPwdForm(false); setPwdMsg(''); }}>
              <User size={20} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="avatar-dropdown">
                <div className="dropdown-user">{user.username}</div>
                <button onClick={() => { setMenuOpen(false); navigate('/profile'); }}>个人资料</button>
                <button onClick={() => setShowPwdForm(!showPwdForm)}>修改密码</button>
                {showPwdForm && (
                  <div className="dropdown-pwd-form">
                    <input type="password" placeholder="原密码" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
                    <input type="password" placeholder="新密码" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                    {pwdMsg && <span className="pwd-msg">{pwdMsg}</span>}
                    <button onClick={handleChangePassword}>保存</button>
                  </div>
                )}
                {isAdmin && <button onClick={() => { setMenuOpen(false); navigate('/admin'); }}>后台管理</button>}
                <button onClick={() => { setMenuOpen(false); logout(); }}>退出登录</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 底部 Tab 栏 */}
      <nav className="bottom-tab-bar">
        <Link to="/map" className={`bottom-tab ${isActive('/map') ? 'active' : ''}`}>
          <Map size={22} aria-hidden="true" />
          <span className="bottom-tab-label">地图</span>
        </Link>
        <Link to="/achievements" className={`bottom-tab ${isActive('/achievements') ? 'active' : ''}`}>
          <Medal size={22} aria-hidden="true" />
          <span className="bottom-tab-label">成就</span>
        </Link>
        <Link to="/map" className="bottom-tab bottom-tab-primary" aria-label="点亮景区">
          <span className="bottom-tab-plus">
            <Plus size={26} aria-hidden="true" />
          </span>
        </Link>
        <Link to="/journeys" className={`bottom-tab ${isActive('/journeys') ? 'active' : ''}`}>
          <Backpack size={22} aria-hidden="true" />
          <span className="bottom-tab-label">行程</span>
        </Link>
        <Link to="/profile" className={`bottom-tab ${isActive('/profile') ? 'active' : ''}`}>
          <User size={22} aria-hidden="true" />
          <span className="bottom-tab-label">我的</span>
        </Link>
      </nav>
    </>
  );
}
