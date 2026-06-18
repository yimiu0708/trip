import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

type Tab = 'users' | 'settings';

interface AdminUser {
  id: number;
  username: string;
  role: string;
  created_at: string;
  lit_count: number;
}

interface Setting {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'users') {
        const data = await api.admin.users();
        setUsers(data);
      } else {
        const data = await api.admin.settings();
        setSettings(data);
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [fetchData, isAdmin, navigate]);

  const handleUpdatePassword = async (userId: number) => {
    if (!newPassword || newPassword.length < 6) {
      setMessage('密码至少6位');
      return;
    }
    try {
      await api.admin.updatePassword(userId, newPassword);
      setMessage('密码修改成功');
      setEditingUser(null);
      setNewPassword('');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('确定删除该用户？此操作不可恢复')) return;
    try {
      await api.admin.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage('用户已删除');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleSaveSettings = async () => {
    const updates: Record<string, string> = {};
    settings.forEach((s) => {
      const el = document.getElementById(`setting-${s.key}`) as HTMLInputElement | null;
      if (el) updates[s.key] = el.value;
    });
    try {
      await api.admin.updateSettings(updates);
      setMessage('配置已保存');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>后台管理</h2>
        <nav>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            <Users size={16} aria-hidden="true" /> 用户管理
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            <Settings size={16} aria-hidden="true" /> 系统配置
          </button>
        </nav>
      </aside>

      <main className="admin-content">
        {message && <div className="toast">{message}</div>}

        {tab === 'users' && (
          <section>
            <h2>用户管理</h2>
            {loading ? (
              <div className="page-loading">加载中...</div>
            ) : (
              <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>角色</th>
                    <th>注册时间</th>
                    <th>已点亮</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>
                        <span className={`role-tag ${u.role}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                      </td>
                      <td>{u.created_at?.slice(0, 10)}</td>
                      <td>{u.lit_count}</td>
                      <td>
                        <div className="action-btns">
                          {editingUser === u.id ? (
                            <div className="inline-form">
                              <input
                                type="password"
                                placeholder="新密码"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoFocus
                              />
                              <button className="btn-small" onClick={() => handleUpdatePassword(u.id)}>保存</button>
                              <button className="btn-small" onClick={() => { setEditingUser(null); setNewPassword(''); }}>取消</button>
                            </div>
                          ) : (
                            <>
                              <button className="btn-small" onClick={() => setEditingUser(u.id)}>修改密码</button>
                              {u.id !== user?.id && (
                                <button className="btn-small danger" onClick={() => handleDeleteUser(u.id)}>删除</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        )}

        {tab === 'settings' && (
          <section>
            <h2>系统配置</h2>
            {loading ? (
              <div className="page-loading">加载中...</div>
            ) : (
              <div className="settings-form">
                {settings.map((s) => (
                  <div key={s.key} className="setting-item">
                    <label>
                      {s.description}
                      <span className="setting-key">{s.key}</span>
                    </label>
                    <input
                      id={`setting-${s.key}`}
                      type="text"
                      defaultValue={s.value}
                    />
                  </div>
                ))}
                <button className="btn-primary" onClick={handleSaveSettings}>保存配置</button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
