import { forwardRef, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Share2, MapPin, Landmark, Building2, Award, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface ProgressData {
  provinceStats?: { lit_provinces: number; total_provinces: number };
  cityStats?: { lit_cities: number; total_cities: number };
  attractionStats?: { lit_attractions: number; total_attractions: number; total_visits?: number };
  provinceBreakdown?: Array<{ id: number; name: string; lit_count: number; total_count: number; region: string }>;
  categoryBreakdown?: Array<{ id: number; name: string; lit_count: number; total_count: number }>;
}

interface SharePosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SharePosterModal({ isOpen, onClose }: SharePosterModalProps) {
  const { user } = useAuth();
  const posterRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationAttempt, setGenerationAttempt] = useState(0);

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/download` : 'https://shijie.app/download';

  useEffect(() => {
    if (!isOpen) return;
    setGenerating(true);
    setPosterUrl('');
    setGenerationError('');
    Promise.all([
      api.user.progress().catch(() => null),
      api.achievements.mine().catch(() => []),
    ]).then(([p, a]) => {
      setProgress((p || {}) as ProgressData);
      setAchievements(Array.isArray(a) ? a : []);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !posterRef.current || !progress) return;
    const node = posterRef.current;

    const capture = async () => {
      await waitForPosterAssets(node);
      toPng(node, { pixelRatio: 3, cacheBust: true })
        .then((url) => setPosterUrl(url))
        .catch(() => { setPosterUrl(''); setGenerationError('海报生成失败，请重试'); })
        .finally(() => setGenerating(false));
    };

    // Wait a tick for fonts / QR SVG to settle.
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(capture, 80);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, progress, achievements, generationAttempt]);

  const litProvinces = progress?.provinceStats?.lit_provinces ?? 0;
  const totalProvinces = progress?.provinceStats?.total_provinces ?? 34;
  const litCities = progress?.cityStats?.lit_cities ?? 0;
  const litAttractions = progress?.attractionStats?.lit_attractions ?? 0;
  const totalVisits = progress?.attractionStats?.total_visits ?? litAttractions;
  const unlockedAchievements = achievements.filter((a) => a?.unlocked_at).length;
  const provincePct = totalProvinces > 0 ? Math.round((litProvinces / totalProvinces) * 100) : 0;
  const topProvince = progress?.provinceBreakdown
    ?.filter((item) => item.lit_count > 0)
    .sort((a, b) => {
      const rateA = a.total_count > 0 ? a.lit_count / a.total_count : 0;
      const rateB = b.total_count > 0 ? b.lit_count / b.total_count : 0;
      return rateB - rateA || b.lit_count - a.lit_count;
    })[0];
  const topCategory = progress?.categoryBreakdown?.find((item) => item.lit_count > 0);
  const posterMood = topProvince ? `${topProvince.name} 正在发光` : litProvinces > 0 ? '中国地图正在发光' : '第一束光，等你点亮';

  const handleDownload = () => {
    if (!posterUrl) return;
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `识界足迹-${user?.username || '我'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!posterUrl) return;
    try {
      const res = await fetch(posterUrl);
      const blob = await res.blob();
      const file = new File([blob], `识界足迹-${user?.username || '我'}.png`, { type: 'image/png' });
      const shareData: ShareData = {
        title: '我的识界足迹',
        text: `我已点亮 ${litProvinces} 个省份、${litCities} 座城市，快来识界一起探索中国！`,
        url: appUrl,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // fall back to download
    }
    handleDownload();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay poster-modal-overlay" onClick={onClose}>
      <div className="modal-content poster-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="poster-close" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>

        <h3 className="poster-modal-title">
          <Share2 size={18} aria-hidden="true" />
          分享我的足迹
        </h3>

        <div className="poster-preview-wrap">
          {posterUrl ? (
            <img
              className="poster-preview"
              src={posterUrl}
              alt="我的识界足迹海报"
            />
          ) : (
            <>
              <div className="poster-live-preview" aria-label="我的识界足迹海报预览">
                <PosterArtwork
                  userName={user?.username || '旅行者'}
                  appUrl={appUrl}
                  litProvinces={litProvinces}
                  totalProvinces={totalProvinces}
                  litCities={litCities}
                  litAttractions={litAttractions}
                  totalVisits={totalVisits}
                  unlockedAchievements={unlockedAchievements}
                  provincePct={provincePct}
                  topProvinceName={topProvince?.name || '待点亮'}
                  topCategoryName={topCategory?.name || '探索中'}
                  mood={posterMood}
                  preview
                />
              </div>
              {generating && (
                <div className="poster-generating-badge">
                  <span className="poster-spinner" />
                  生成高清图…
                </div>
              )}
              {!generating && generationError && <button className="poster-retry" type="button" onClick={() => { setGenerating(true); setGenerationError(''); setGenerationAttempt((value) => value + 1); }}>{generationError}</button>}
            </>
          )}
        </div>

        <div className="poster-modal-actions">
          <button className="btn-small" onClick={onClose}>关闭</button>
          <button className="btn-primary" onClick={handleDownload} disabled={!posterUrl}>
            <Download size={16} aria-hidden="true" />
            保存图片
          </button>
          <button className="btn-primary" onClick={handleShare} disabled={!posterUrl}>
            <Share2 size={16} aria-hidden="true" />
            分享
          </button>
        </div>
      </div>

      {/* Off-screen poster source */}
      <PosterArtwork
        ref={posterRef}
        userName={user?.username || '旅行者'}
        appUrl={appUrl}
        litProvinces={litProvinces}
        totalProvinces={totalProvinces}
        litCities={litCities}
        litAttractions={litAttractions}
        totalVisits={totalVisits}
        unlockedAchievements={unlockedAchievements}
        provincePct={provincePct}
        topProvinceName={topProvince?.name || '待点亮'}
        topCategoryName={topCategory?.name || '探索中'}
        mood={posterMood}
      />
    </div>
  );
}

interface PosterArtworkProps {
  userName: string;
  appUrl: string;
  litProvinces: number;
  totalProvinces: number;
  litCities: number;
  litAttractions: number;
  totalVisits: number;
  unlockedAchievements: number;
  provincePct: number;
  topProvinceName: string;
  topCategoryName: string;
  mood: string;
  preview?: boolean;
}

const PosterArtwork = forwardRef<HTMLDivElement, PosterArtworkProps>(function PosterArtwork(
  {
    userName,
    appUrl,
    litProvinces,
    totalProvinces,
    litCities,
    litAttractions,
    totalVisits,
    unlockedAchievements,
    provincePct,
    topProvinceName,
    topCategoryName,
    mood,
    preview = false,
  },
  ref,
) {
  return (
  <div
    ref={ref}
    className={`share-poster ${preview ? 'share-poster-preview' : ''}`}
    aria-hidden={!preview}
  >
    <div className="share-poster-bg" />
    <div className="share-poster-map" aria-hidden="true">
      <img src="/images/shijie-logo-mark.png" alt="" />
      <span className="share-poster-route route-one" />
      <span className="share-poster-route route-two" />
      <span className="share-poster-node node-one" />
      <span className="share-poster-node node-two" />
      <span className="share-poster-node node-three" />
      <span className="share-poster-node node-four" />
    </div>

    <header className="share-poster-brand">
      <div className="share-poster-brand-lockup">
        <img src="/images/shijie-logo-mark.png" alt="" />
        <div>
          <strong>识界</strong>
          <span>Light your life</span>
        </div>
      </div>
      <span className="share-poster-badge">旅行足迹海报</span>
    </header>

    <section className="share-poster-hero">
      <div className="share-poster-userline">
        <Sparkles size={14} aria-hidden="true" />
        <span>@{userName} 的中国光迹</span>
      </div>
      <h2>我点亮了</h2>
      <div className="share-poster-percent">
        {provincePct}<span>%</span>
      </div>
      <p className="share-poster-copy">
        已点亮 <em>{litProvinces}</em> / {totalProvinces} 个省份
      </p>
    </section>

    <section className="share-poster-stats" aria-label="足迹数据">
      <div className="share-poster-stat">
        <Landmark size={18} aria-hidden="true" />
        <strong>{litProvinces}</strong>
        <span>省份</span>
      </div>
      <div className="share-poster-stat">
        <Building2 size={18} aria-hidden="true" />
        <strong>{litCities}</strong>
        <span>城市</span>
      </div>
      <div className="share-poster-stat">
        <MapPin size={18} aria-hidden="true" />
        <strong>{litAttractions}</strong>
        <span>{totalVisits}次到访</span>
      </div>
      <div className="share-poster-stat">
        <Award size={18} aria-hidden="true" />
        <strong>{unlockedAchievements}</strong>
        <span>成就</span>
      </div>
    </section>

    <section className="share-poster-insights">
      <div>
        <span>最亮目的地</span>
        <strong>{topProvinceName}</strong>
      </div>
      <div>
        <span>探索偏好</span>
        <strong>{topCategoryName}</strong>
      </div>
    </section>

    <p className="share-poster-slogan">{mood}，下一站继续点亮。</p>

    <footer className="share-poster-footer">
      <div className="share-poster-qr">
        <QRCodeSVG value={appUrl} size={82} level="M" includeMargin={false} />
      </div>
      <div className="share-poster-cta">
        <strong>扫码加入识界</strong>
        <span>生成你的旅行光迹</span>
      </div>
    </footer>
  </div>
  );
});

async function waitForPosterAssets(node: HTMLElement) {
  await document.fonts?.ready;
  await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => image.complete ? image.decode?.().catch(() => undefined) : new Promise<void>((resolve) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); })));
}
