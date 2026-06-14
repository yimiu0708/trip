import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { echarts } from '../lib/echarts';
import { Camera, Edit3, MapPin, Medal, PartyPopper, Save, Tag, UserRound } from 'lucide-react';
import AchievementBadge from '../components/AchievementBadge';
import { useAuth } from '../context/AuthContext';

interface Achievement {
  id: number;
  name: string;
  type: string;
  level: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
  unlocked_at: string | null;
}

interface CommunityProfile {
  displayName: string;
  signature: string;
  location: string;
  travelStyle: string;
  avatarDataUrl: string;
}

const DEFAULT_SIGNATURE = '记录走过的地方，也记录想去的远方。';
const PROFILE_STORAGE_PREFIX = 'trip_community_profile_';

export default function ProfilePage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile>(() => ({
    displayName: '',
    signature: DEFAULT_SIGNATURE,
    location: '',
    travelStyle: '山海探索者',
    avatarDataUrl: '',
  }));
  const [profileDraft, setProfileDraft] = useState<CommunityProfile>(communityProfile);

  const profileStorageKey = user ? `${PROFILE_STORAGE_PREFIX}${user.id}` : '';

  useEffect(() => {
    Promise.all([api.user.progress(), api.achievements.mine()])
      .then(([p, a]) => {
        setProgress(p);
        setAchievements(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const fallback: CommunityProfile = {
      displayName: user.username,
      signature: DEFAULT_SIGNATURE,
      location: '',
      travelStyle: '山海探索者',
      avatarDataUrl: '',
    };
    const raw = localStorage.getItem(`${PROFILE_STORAGE_PREFIX}${user.id}`);
    if (!raw) {
      setCommunityProfile(fallback);
      setProfileDraft(fallback);
      return;
    }
    try {
      const parsed = { ...fallback, ...JSON.parse(raw) } as CommunityProfile;
      setCommunityProfile(parsed);
      setProfileDraft(parsed);
    } catch {
      setCommunityProfile(fallback);
      setProfileDraft(fallback);
    }
  }, [user]);

  useEffect(() => {
    if (!progress) return;
    const el = document.getElementById('province-chart');
    if (!el) return;
    const chart = echarts.init(el);

    const regions = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '港澳台'];
    const regionData = regions.map((r) => {
      const items = progress.provinceBreakdown.filter((p: any) => p.region === r);
      const lit = items.filter((p: any) => p.lit_count > 0).length;
      return { name: r, value: lit };
    });

    chart.setOption({
      color: ['#2F9EAA', '#7FD6D3', '#8CCFE8', '#D8B76A', '#35A77D', '#FF8A6B', '#9FC9D8', '#BEE9E7'],
      title: { text: '省份点亮进度', left: 'center', textStyle: { fontSize: 16, color: '#0f172a' } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} 省已点亮' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: regionData.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    });

    return () => chart.dispose();
  }, [progress]);

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!progress) return <div className="page-loading">加载失败</div>;

  const { provinceStats, attractionStats, categoryBreakdown } = progress;
  const displayName = communityProfile.displayName.trim() || user?.username || '旅行者';
  const profileInitial = displayName.slice(0, 1).toUpperCase();

  const provinceLine = achievements.filter((a) => a.type === 'province');
  const attractionLine = achievements.filter((a) => a.type === 'attraction');
  const specialLine = achievements.filter((a) => a.type === 'special');

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMessage('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage('头像图片需小于 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileDraft((prev) => ({ ...prev, avatarDataUrl: String(reader.result || '') }));
      setProfileMessage('');
    };
    reader.readAsDataURL(file);
  };

  const saveCommunityProfile = () => {
    if (!profileStorageKey) return;
    const normalized = {
      ...profileDraft,
      displayName: profileDraft.displayName.trim() || user?.username || '旅行者',
      signature: profileDraft.signature.trim() || DEFAULT_SIGNATURE,
      location: profileDraft.location.trim(),
      travelStyle: profileDraft.travelStyle.trim() || '山海探索者',
    };
    setCommunityProfile(normalized);
    setProfileDraft(normalized);
    localStorage.setItem(profileStorageKey, JSON.stringify(normalized));
    setEditingProfile(false);
    setProfileMessage('资料已保存');
    setTimeout(() => setProfileMessage(''), 1800);
  };

  const cancelProfileEdit = () => {
    setProfileDraft(communityProfile);
    setEditingProfile(false);
    setProfileMessage('');
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {communityProfile.avatarDataUrl ? (
                <img src={communityProfile.avatarDataUrl} alt={displayName} />
              ) : (
                <span>{profileInitial}</span>
              )}
            </div>
          </div>
          <div className="profile-identity-main">
            <div className="profile-title-row">
              <h1>{displayName}</h1>
              <button className="profile-edit-btn" type="button" onClick={() => setEditingProfile(true)}>
                <Edit3 size={15} aria-hidden="true" />
                <span>编辑资料</span>
              </button>
            </div>
            <p className="profile-signature">{communityProfile.signature}</p>
            <div className="profile-meta-row">
              <span><UserRound size={14} aria-hidden="true" /> @{user?.username || 'guest'}</span>
              {communityProfile.location && <span><MapPin size={14} aria-hidden="true" /> {communityProfile.location}</span>}
              <span>{communityProfile.travelStyle}</span>
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <div className="p-stat">
            <div className="p-stat-num">{provinceStats.lit_provinces}</div>
            <div className="p-stat-label">点亮省份</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">{attractionStats.lit_attractions}</div>
            <div className="p-stat-label">点亮景区</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">{achievements.filter((a) => a.unlocked_at).length}</div>
            <div className="p-stat-label">获得成就</div>
          </div>
        </div>
      </div>

      {editingProfile && (
        <div className="profile-section profile-editor">
          <div className="profile-editor-head">
            <h2><Edit3 size={18} aria-hidden="true" /> 社区资料</h2>
            {profileMessage && <span className="profile-editor-msg">{profileMessage}</span>}
          </div>
          <div className="profile-editor-grid">
            <label className="profile-avatar-uploader">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleAvatarChange(event.target.files?.[0])}
              />
              <span className="profile-avatar large">
                {profileDraft.avatarDataUrl ? (
                  <img src={profileDraft.avatarDataUrl} alt="头像预览" />
                ) : (
                  <Camera size={26} aria-hidden="true" />
                )}
              </span>
              <em>上传头像</em>
            </label>
            <div className="profile-form">
              <label>
                昵称
                <input
                  value={profileDraft.displayName}
                  maxLength={20}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="给社区里的自己起个名字"
                />
              </label>
              <label>
                签名
                <textarea
                  value={profileDraft.signature}
                  maxLength={80}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, signature: event.target.value }))}
                  placeholder="写一句你想被记住的话"
                />
              </label>
              <div className="profile-form-row">
                <label>
                  所在地
                  <input
                    value={profileDraft.location}
                    maxLength={24}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder="例如：上海"
                  />
                </label>
                <label>
                  旅行标签
                  <input
                    value={profileDraft.travelStyle}
                    maxLength={24}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, travelStyle: event.target.value }))}
                    placeholder="例如：古镇收藏家"
                  />
                </label>
              </div>
              <div className="profile-editor-actions">
                <button type="button" className="btn-small" onClick={cancelProfileEdit}>取消</button>
                <button type="button" className="btn-primary" onClick={saveCommunityProfile}>
                  <Save size={16} aria-hidden="true" /> 保存资料
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!editingProfile && profileMessage && <div className="toast">{profileMessage}</div>}

      <div className="profile-section">
        <div className="chart-box">
          <div id="province-chart" style={{ width: '100%', height: 320 }} />
          <div className="chart-center-text">
            <div className="cct-num">{provinceStats.lit_provinces}/{provinceStats.total_provinces}</div>
            <div className="cct-label">省份</div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2><Tag size={18} /> 分类点亮进度</h2>
        <div className="category-progress-list">
          {categoryBreakdown.map((c: any) => {
            const pct = c.total_count > 0 ? Math.round((c.lit_count / c.total_count) * 100) : 0;
            return (
              <div key={c.id} className="category-progress-item">
                <div className="cpi-header">
                  <span className="cpi-name">{c.name}</span>
                  <span className="cpi-num">{c.lit_count}/{c.total_count} ({pct}%)</span>
                </div>
                <div className="cpi-bar">
                  <div className="cpi-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="profile-section">
        <div className="achievement-header">
          <h2><Medal size={18} /> 成就墙</h2>
          <div className="achievement-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
            <button className={filter === 'unlocked' ? 'active' : ''} onClick={() => setFilter('unlocked')}>已解锁</button>
            <button className={filter === 'locked' ? 'active' : ''} onClick={() => setFilter('locked')}>未解锁</button>
          </div>
        </div>

        <div className="achievement-group">
          <h3>省份探索</h3>
          <div className="badge-grid">
            {provinceLine.map((a) => <AchievementBadge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3>景区达人</h3>
          <div className="badge-grid">
            {attractionLine.map((a) => <AchievementBadge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3><PartyPopper size={18} /> 彩蛋成就</h3>
          <div className="badge-grid">
            {specialLine.map((a) => <AchievementBadge key={a.id} a={a} special />)}
          </div>
        </div>
      </div>
    </div>
  );
}
