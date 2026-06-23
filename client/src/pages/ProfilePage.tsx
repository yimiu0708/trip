import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Camera,
  Compass,
  Edit3,
  Save,
  ChevronRight,
  Heart,
  MapPin,
  Sparkles,
  LogOut,
  Lock,
  Info,
  Trophy,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AchievementBadge from '../components/AchievementBadge';
import type { PersonalityResult } from '../lib/personality';

interface CommunityProfile {
  displayName: string;
  signature: string;
  location: string;
  avatarDataUrl: string;
}

interface ProfileProgress {
  provinceStats?: {
    lit_provinces: number;
    total_provinces: number;
  };
  cityStats?: {
    lit_cities: number;
    total_cities: number;
  };
  attractionStats?: {
    lit_attractions: number;
    total_visits: number;
    total_attractions: number;
  };
  achievementCount?: number;
  provinceBreakdown?: ProvinceProgress[];
}

interface ProvinceProgress {
  id: number;
  name: string;
  lit_count: number;
  total_count: number;
}

interface Achievement {
  id: number;
  name: string;
  display_name?: string;
  display_desc?: string;
  type: string;
  level: number | null;
  condition_desc: string;
  icon: string;
  artwork_path?: string;
  badge_style: string;
  unlocked_at: string | null;
  unlock_count?: number;
  snapshot_lit?: number | null;
  snapshot_total?: number | null;
  snapshot_percent?: number | null;
  is_current_max?: number | null;
  is_equipped?: number;
}

const DEFAULT_SIGNATURE = '记录走过的地方，也记录想去的远方。';
const PROFILE_STORAGE_PREFIX = 'trip_community_profile_';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [personality, setPersonality] = useState<PersonalityResult | null>(null);
  const [profileNow] = useState(() => Date.now());
  const [communityProfile, setCommunityProfile] = useState<CommunityProfile>(() => ({
    displayName: '',
    signature: DEFAULT_SIGNATURE,
    location: '',
    avatarDataUrl: '',
  }));
  const [profileDraft, setProfileDraft] = useState<CommunityProfile>(communityProfile);

  const profileStorageKey = user ? `${PROFILE_STORAGE_PREFIX}${user.id}` : '';

  useEffect(() => {
    if (!user) return;
    const fallback: CommunityProfile = {
      displayName: user.username,
      signature: DEFAULT_SIGNATURE,
      location: '',
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
    if (!user) return;
    let ignore = false;
    Promise.all([
      api.user.progress(),
      api.achievements.mine().catch(() => []),
      api.personality.mine().catch(() => ({ hasResult: false })),
    ])
      .then(([profileProgress, achievements, personalityResult]) => {
        if (ignore) return;
        setProgress(profileProgress);
        setAchievements(Array.isArray(achievements) ? achievements : []);
        setPersonality(personalityResult.hasResult ? personalityResult : null);
      })
      .catch(() => {
        if (!ignore) setProgress(null);
      });
    return () => {
      ignore = true;
    };
  }, [user]);

  const displayName = communityProfile.displayName.trim() || user?.username || 'Yimiu';
  const profileInitial = displayName.slice(0, 1).toUpperCase();
  const passportNo = String(user?.id || 0).padStart(4, '0');
  const profileSignature = communityProfile.signature.trim() || DEFAULT_SIGNATURE;
  const profileLocation = communityProfile.location.trim() || '待盖章';
  const litAttractions = progress?.attractionStats?.lit_attractions || 0;
  const totalAttractions = progress?.attractionStats?.total_attractions || 0;
  const attractionRate = totalAttractions > 0 ? Math.round((litAttractions / totalAttractions) * 100) : 0;
  const recentBadges = [...achievements]
    .filter((achievement) => achievement.unlocked_at)
    .sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)))
    .slice(0, 3);
  const equippedBadge = achievements.find((achievement) => achievement.is_equipped);
  const joinedDays = user?.created_at
    ? Math.max(1, Math.floor((profileNow - new Date(user.created_at).getTime()) / 86400000) + 1)
    : 1;

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

  const showComingSoon = (text: string) => {
    setProfileMessage(text);
    setTimeout(() => setProfileMessage(''), 1800);
  };

  return (
    <div className="profile-page profile-page-v3">
      <header className="profile-v3-titlebar floating-page-titlebar">
        <div>
          <h1 className="profile-v3-heading floating-page-heading">
            <User className="floating-page-icon" size={22} aria-hidden="true" />
            <span>我的</span>
          </h1>
        </div>
      </header>

      <section className="profile-v3-hero">
        <div className="profile-v3-mapfield" aria-hidden="true">
          <img src="/images/shijie-logo-mark.png" alt="" />
          <span className="profile-v3-node node-a" />
          <span className="profile-v3-node node-b" />
          <span className="profile-v3-node node-c" />
          <span className="profile-v3-route route-a" />
          <span className="profile-v3-route route-b" />
        </div>

        <div className="profile-v3-identity">
          <div className="profile-v3-avatar-wrap">
            <div className="profile-v3-avatar">
              {communityProfile.avatarDataUrl ? (
                <img src={communityProfile.avatarDataUrl} alt={displayName} />
              ) : (
                <span>{profileInitial}</span>
              )}
            </div>
          </div>
          <div className="profile-v3-main">
            <div className="profile-v3-id">SHIJIE ID · {passportNo}</div>
            <div className="profile-v3-name-row">
              <h2>{displayName}</h2>
              <button
                type="button"
                className="profile-v3-icon-btn"
                onClick={() => setEditingProfile(true)}
                aria-label="编辑资料"
                title="编辑资料"
              >
                <Edit3 size={15} aria-hidden="true" />
              </button>
            </div>
            <p>{profileSignature}</p>
            <small>加入识界第 {joinedDays} 天</small>
          </div>
        </div>

        <div className="profile-v3-chips" aria-label="个人信息">
          <span><MapPin size={13} aria-hidden="true" />{profileLocation}</span>
          <span className="profile-personality-chip"><Compass size={13} aria-hidden="true" />旅行人格：{personality ? `${personality.typeCode} ${personality.typeName}` : '待发现'}</span>
          {equippedBadge?.artwork_path && <span className="profile-equipped-badge" title={`已佩戴：${equippedBadge.display_name || equippedBadge.name}`}><img src={equippedBadge.artwork_path} alt="" />已佩戴</span>}
        </div>

        <div className="profile-v3-progress">
          <div>
            <span>景区点亮率</span>
            <strong>{attractionRate}%</strong>
          </div>
          <div className="profile-v3-progress-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, attractionRate)}%` }} />
          </div>
        </div>
      </section>

      <section className="profile-v3-core-actions" aria-label="旅行功能">
        <button type="button" onClick={() => navigate('/achievements')}><span><Trophy size={21} /></span><strong>成就中心</strong></button>
        <button type="button" className="personality" onClick={() => navigate(personality ? '/personality/result' : '/personality/test')}><span><Sparkles size={21} /></span><strong>旅行人格</strong><em>{personality ? personality.typeCode : '待发现'}</em></button>
        <button type="button" className="favorites" onClick={() => navigate('/favorites')}><span><Heart size={21} /></span><strong>我的收藏</strong></button>
      </section>

      <section className="profile-v3-recent-badges" aria-label="最近获得的徽章">
        <div className="profile-v3-section-head">
          <span><Award size={18} aria-hidden="true" />最近获得</span>
          <em>{recentBadges.length ? `${recentBadges.length} 枚` : '暂无'}</em>
        </div>
        {recentBadges.length ? (
          <div className="profile-v3-badge-row">
            {recentBadges.map((achievement) => (
              <AchievementBadge
                key={`profile-recent-${achievement.id}`}
                a={achievement}
                special={achievement.type === 'special'}
                variant="compact"
              />
            ))}
          </div>
        ) : (
          <div className="profile-v3-empty-panel"><strong>还没有解锁成就</strong><span>去点亮第一个足迹，开启你的识界旅程</span></div>
        )}
      </section>

      <section className="profile-v3-menu" aria-label="我的功能">
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('修改密码功能即将开放')}>
          <span><Lock size={20} aria-hidden="true" /></span>
          <strong>修改密码</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('识界 V0.3 · 用足迹认识世界，也认识自己')}>
          <span><Info size={20} aria-hidden="true" /></span>
          <strong>关于识界</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v3-menu-item danger" onClick={() => { logout(); navigate('/login'); }}>
          <span><LogOut size={20} aria-hidden="true" /></span>
          <strong>退出登录</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      {!editingProfile && profileMessage && <div className="toast">{profileMessage}</div>}

      {/* 编辑资料弹窗 */}
      {editingProfile && (
        <div className="modal-overlay" onClick={cancelProfileEdit}>
          <div className="modal-content profile-editor" onClick={(e) => e.stopPropagation()}>
            <div className="profile-editor-head">
              <h2>编辑资料</h2>
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
                <div className="profile-form-row single">
                  <label>
                    所在地
                    <input
                      value={profileDraft.location}
                      maxLength={24}
                      onChange={(event) => setProfileDraft((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="例如：上海"
                    />
                  </label>
                </div>
                <div className="profile-editor-actions">
                  <button type="button" className="btn-small" onClick={cancelProfileEdit}>
                    取消
                  </button>
                  <button type="button" className="btn-primary" onClick={saveCommunityProfile}>
                    <Save size={16} aria-hidden="true" /> 保存资料
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
