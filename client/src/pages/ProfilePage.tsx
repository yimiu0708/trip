import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Edit3,
  Save,
  Footprints,
  ChevronRight,
  HelpCircle,
  Settings,
  Star,
  Map,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const displayName = communityProfile.displayName.trim() || user?.username || 'Yimiu';
  const profileInitial = displayName.slice(0, 1).toUpperCase();
  const passportNo = String(user?.id || 0).padStart(4, '0');
  const profileSignature = communityProfile.signature.trim() || DEFAULT_SIGNATURE;
  const profileLocation = communityProfile.location.trim() || '待盖章';
  const profileStyle = communityProfile.travelStyle.trim() || '山海探索者';

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

  const showComingSoon = (text: string) => {
    setProfileMessage(text);
    setTimeout(() => setProfileMessage(''), 1800);
  };

  return (
    <div className="profile-page profile-page-v2">
      <h1 className="profile-page-title">我的</h1>

      {/* 旅行护照 */}
      <div className="profile-v2-card">
        <div className="profile-v2-passport-mark">
          <span>TRAVEL PASSPORT</span>
          <strong>No.{passportNo}</strong>
        </div>
        <div className="profile-v2-mountain-bg" aria-hidden="true">
          <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="mtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(224, 247, 250, 0.85)" />
                <stop offset="100%" stopColor="rgba(178, 235, 242, 0.45)" />
              </linearGradient>
            </defs>
            <path d="M40 120 L90 35 L130 90 L160 50 L200 120 Z" fill="url(#mtGrad)" />
            <path d="M100 120 L140 55 L175 100 L200 80 L220 120 Z" fill="rgba(224, 247, 250, 0.55)" />
          </svg>
        </div>
        <div className="profile-v2-passport-stamp" aria-hidden="true">
          <span>PASSPORT</span>
          <strong>识界</strong>
          <em>Light your life</em>
        </div>
        <div className="profile-v2-header">
          <div className="profile-v2-avatar">
            {communityProfile.avatarDataUrl ? (
              <img src={communityProfile.avatarDataUrl} alt={displayName} />
            ) : (
              <span>{profileInitial}</span>
            )}
          </div>
          <div className="profile-v2-info">
            <div className="profile-v2-name-row">
              <h2>旅行者 {displayName}</h2>
              <button
                type="button"
                className="profile-v2-edit"
                onClick={() => setEditingProfile(true)}
                aria-label="编辑资料"
              >
                <Edit3 size={14} aria-hidden="true" />
              </button>
            </div>
            <p className="profile-v2-subtitle">{profileSignature}</p>
          </div>
        </div>
        <div className="profile-v2-passport-fields">
          <div>
            <span>签发地</span>
            <strong>{profileLocation}</strong>
          </div>
          <div>
            <span>旅行身份</span>
            <strong>{profileStyle}</strong>
          </div>
          <div>
            <span>护照状态</span>
            <strong>持续探索</strong>
          </div>
        </div>
        <div className="profile-v2-passport-code" aria-hidden="true">
          <span>P&lt;SHIJIE&lt;{displayName.replace(/\s+/g, '').toUpperCase()}</span>
          <span>SJ{passportNo}&lt;&lt;&lt;&lt;LIGHT&lt;&lt;YOUR&lt;&lt;LIFE</span>
        </div>
      </div>

      {/* 功能菜单 */}
      <div className="profile-v2-section profile-v2-menu">
        <button type="button" className="profile-v2-menu-item" onClick={() => showComingSoon('收藏功能开发中')}>
          <Star size={20} aria-hidden="true" />
          <span>我的收藏</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v2-menu-item" onClick={() => navigate('/journeys')}>
          <Footprints size={20} aria-hidden="true" />
          <span>我的足迹</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v2-menu-item" onClick={() => showComingSoon('离线地图开发中')}>
          <Map size={20} aria-hidden="true" />
          <span>离线地图</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v2-menu-item" onClick={() => showComingSoon('设置功能开发中')}>
          <Settings size={20} aria-hidden="true" />
          <span>设置</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v2-menu-item" onClick={() => showComingSoon('帮助与反馈开发中')}>
          <HelpCircle size={20} aria-hidden="true" />
          <span>帮助与反馈</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

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
