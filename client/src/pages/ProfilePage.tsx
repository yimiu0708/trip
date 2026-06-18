import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Camera,
  Compass,
  Edit3,
  Save,
  ChevronRight,
  HelpCircle,
  History,
  MapPinned,
  Settings,
  Star,
  Map,
  MapPin,
  Target,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AchievementBadge from '../components/AchievementBadge';
import { archiveGoal, clearCurrentGoal, readCurrentGoal, readGoalHistory, type GoalHistoryEntry } from '../lib/goals';

interface CommunityProfile {
  displayName: string;
  signature: string;
  location: string;
  travelStyle: string;
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
  badge_style: string;
  unlocked_at: string | null;
  unlock_count?: number;
  snapshot_lit?: number | null;
  snapshot_total?: number | null;
  snapshot_percent?: number | null;
  is_current_max?: number | null;
}

const DEFAULT_SIGNATURE = '记录走过的地方，也记录想去的远方。';
const PROFILE_STORAGE_PREFIX = 'trip_community_profile_';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [goalReviewOpen, setGoalReviewOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [goalHistory, setGoalHistory] = useState<GoalHistoryEntry[]>(() => readGoalHistory());
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

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    Promise.all([
      api.user.progress(),
      api.achievements.mine().catch(() => []),
    ])
      .then(([profileProgress, achievements]) => {
        if (ignore) return;
        const activeGoal = readCurrentGoal();
        if (activeGoal) {
          const provinceProgress = (profileProgress.provinceBreakdown || []).find((item: ProvinceProgress) => item.id === activeGoal.provinceId);
          const goalProgress = provinceProgress && provinceProgress.total_count > 0
            ? Math.round((provinceProgress.lit_count / provinceProgress.total_count) * 100)
            : 0;
          if (goalProgress >= activeGoal.targetProgress) {
            archiveGoal(activeGoal, goalProgress);
            clearCurrentGoal();
          }
        }
        setProgress(profileProgress);
        setAchievements(Array.isArray(achievements) ? achievements : []);
        setGoalHistory(readGoalHistory());
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
  const profileStyle = communityProfile.travelStyle.trim() || '山海探索者';
  const litAttractions = progress?.attractionStats?.lit_attractions || 0;
  const totalAttractions = progress?.attractionStats?.total_attractions || 0;
  const attractionRate = totalAttractions > 0 ? Math.round((litAttractions / totalAttractions) * 100) : 0;
  const provinceProgress = progress?.provinceBreakdown || [];
  const recentBadges = [...achievements]
    .filter((achievement) => achievement.unlocked_at)
    .sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)))
    .slice(0, 4);
  const goalHistoryViews = goalHistory
    .filter((goal) => goal.achievedAt)
    .slice(0, 8)
    .map((goal) => buildGoalView(goal, provinceProgress));

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

  const openGoalReview = () => {
    setGoalHistory(readGoalHistory());
    setGoalReviewOpen(true);
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
          </div>
        </div>

        <div className="profile-v3-chips" aria-label="个人旅行标签">
          <span><MapPin size={13} aria-hidden="true" />{profileLocation}</span>
          <span><Compass size={13} aria-hidden="true" />{profileStyle}</span>
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

      <section className="profile-v3-goal-panel" aria-label="目标回顾">
        <button type="button" className="profile-v3-goal-entry" onClick={openGoalReview}>
          <span className="profile-v3-goal-icon"><Target size={22} aria-hidden="true" /></span>
          <span className="profile-v3-goal-copy">
            <strong>目标回顾</strong>
            <em>
              {goalHistoryViews[0]
                ? `最近达成：${goalHistoryViews[0].provinceName} ${goalHistoryViews[0].targetProgress}%`
                : '查看已达成目标记录'}
            </em>
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </section>

      <section className="profile-v3-recall-panel" aria-label="继续补录足迹">
        <button type="button" className="profile-v3-goal-entry profile-v3-recall-entry" onClick={() => navigate('/recall/cities')}>
          <span className="profile-v3-goal-icon"><MapPinned size={22} aria-hidden="true" /></span>
          <span className="profile-v3-goal-copy">
            <strong>继续补录足迹</strong>
            <em>从记得的城市开始，补回去过的景区</em>
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
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
          <div className="profile-v3-empty-panel">点亮景点后，最近获得的徽章会出现在这里</div>
        )}
      </section>

      <section className="profile-v3-menu" aria-label="我的功能">
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('收藏功能开发中')}>
          <span><Star size={20} aria-hidden="true" /></span>
          <strong>我的收藏</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('离线地图开发中')}>
          <span><Map size={20} aria-hidden="true" /></span>
          <strong>离线地图</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('设置功能开发中')}>
          <span><Settings size={20} aria-hidden="true" /></span>
          <strong>设置</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="profile-v3-menu-item" onClick={() => showComingSoon('帮助与反馈开发中')}>
          <span><HelpCircle size={20} aria-hidden="true" /></span>
          <strong>帮助与反馈</strong>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      {!editingProfile && profileMessage && <div className="toast">{profileMessage}</div>}

      {goalReviewOpen && (
        <div className="modal-overlay profile-goal-review-overlay" onClick={() => setGoalReviewOpen(false)}>
          <div className="modal-content profile-goal-review" onClick={(event) => event.stopPropagation()}>
            <div className="profile-goal-review-head">
              <div>
                <span><History size={15} aria-hidden="true" />目标历史</span>
                <h2>达成情况</h2>
              </div>
              <button
                type="button"
                className="profile-v3-icon-btn"
                onClick={() => setGoalReviewOpen(false)}
                aria-label="关闭目标回顾"
                title="关闭"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="profile-goal-history-head">
              <span>已达成目标</span>
              <em>{goalHistoryViews.length} 条</em>
            </div>
            {goalHistoryViews.length ? (
              <div className="profile-goal-history-list">
                {goalHistoryViews.map((goal) => (
                  <GoalReviewCard key={goal.id} goal={goal} />
                ))}
              </div>
            ) : (
              <div className="profile-goal-empty">
                <Target size={22} aria-hidden="true" />
                <span>达成目标后，会自动记录在这里</span>
              </div>
            )}
          </div>
        </div>
      )}

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

interface GoalView {
  id: string;
  provinceName: string;
  targetProgress: number;
  progress: number;
  targetDate?: string;
  archivedAt?: string;
  status: 'achieved' | 'active' | 'missed';
  statusLabel: string;
}

function GoalReviewCard({ goal, featured = false }: { goal: GoalView; featured?: boolean }) {
  return (
    <article className={`profile-goal-card ${featured ? 'featured' : ''} ${goal.status}`}>
      <div className="profile-goal-card-top">
        <div>
          <span>{featured ? '当前目标' : formatShortDate(goal.archivedAt || '')}</span>
          <strong>{goal.provinceName}</strong>
        </div>
        <em>{goal.statusLabel}</em>
      </div>
      <div className="profile-goal-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, goal.progress)}%` }} />
        <i style={{ left: `${Math.min(100, goal.targetProgress)}%` }} />
      </div>
      <div className="profile-goal-card-foot">
        <span>{goal.progress}% / {goal.targetProgress}%</span>
        <span>{goal.targetDate ? `截止 ${formatShortDate(goal.targetDate)}` : '不限时间'}</span>
      </div>
    </article>
  );
}

function buildGoalView(goal: GoalHistoryEntry, provinceProgress: ProvinceProgress[]): GoalView {
  const province = provinceProgress.find((item) => item.id === goal.provinceId);
  const currentProgress = province && province.total_count > 0
    ? Math.round((province.lit_count / province.total_count) * 100)
    : 0;
  const progress = goal.progressAtArchive !== undefined
    ? goal.progressAtArchive
    : currentProgress;
  const achieved = progress >= goal.targetProgress;

  return {
    id: goal.id,
    provinceName: province?.name || `省份 #${goal.provinceId}`,
    targetProgress: goal.targetProgress,
    targetDate: goal.targetDate,
    archivedAt: goal.achievedAt || goal.archivedAt,
    progress,
    status: achieved ? 'achieved' : 'active',
    statusLabel: achieved ? '已达成' : '已记录',
  };
}

function formatShortDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
