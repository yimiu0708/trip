import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Share2, MapPin, Landmark, Building2, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface ProgressData {
  provinceStats?: { lit_provinces: number; total_provinces: number };
  cityStats?: { lit_cities: number; total_cities: number };
  attractionStats?: { lit_attractions: number; total_attractions: number };
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

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/download` : 'https://shijie.app/download';

  useEffect(() => {
    if (!isOpen) return;
    setGenerating(true);
    setPosterUrl('');
    Promise.all([
      api.user.progress().catch(() => null),
      api.achievements.mine().catch(() => []),
    ]).then(([p, a]) => {
      setProgress(p as ProgressData | null);
      setAchievements(Array.isArray(a) ? a : []);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !posterRef.current || !progress) return;
    const node = posterRef.current;

    const capture = () => {
      toPng(node, { pixelRatio: 3, cacheBust: true })
        .then((url) => setPosterUrl(url))
        .catch(() => setPosterUrl(''))
        .finally(() => setGenerating(false));
    };

    // Wait a tick for fonts / QR SVG to settle.
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(capture, 80);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, progress, achievements]);

  const litProvinces = progress?.provinceStats?.lit_provinces ?? 0;
  const totalProvinces = progress?.provinceStats?.total_provinces ?? 34;
  const litCities = progress?.cityStats?.lit_cities ?? 0;
  const litAttractions = progress?.attractionStats?.lit_attractions ?? 0;
  const unlockedAchievements = achievements.filter((a) => a?.unlocked_at).length;
  const provincePct = totalProvinces > 0 ? Math.round((litProvinces / totalProvinces) * 100) : 0;

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
          {generating && !posterUrl && (
            <div className="poster-generating">
              <span className="poster-spinner" />
              正在生成海报…
            </div>
          )}
          {posterUrl && (
            <img
              className="poster-preview"
              src={posterUrl}
              alt="我的识界足迹海报"
            />
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
      <div
        ref={posterRef}
        className="share-poster"
        aria-hidden="true"
      >
        <div className="share-poster-bg" />
        <div className="share-poster-glow share-poster-glow-1" />
        <div className="share-poster-glow share-poster-glow-2" />

        <div className="share-poster-brand">
          <img src="/images/shijie-logo-mark.png" alt="" />
          <div>
            <strong>识界</strong>
            <span>Light your life</span>
          </div>
        </div>

        <div className="share-poster-headline">
          <span className="share-poster-label">点亮中国</span>
          <div className="share-poster-percent">
            {provincePct}<span>%</span>
          </div>
          <p className="share-poster-copy">
            已点亮 <em>{litProvinces}</em> / {totalProvinces} 个省份
          </p>
        </div>

        <div className="share-poster-stats">
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
            <span>景点</span>
          </div>
          <div className="share-poster-stat">
            <Award size={18} aria-hidden="true" />
            <strong>{unlockedAchievements}</strong>
            <span>成就</span>
          </div>
        </div>

        <div className="share-poster-divider" />

        <p className="share-poster-slogan">
          把每一次出发，都点亮世界的角落
        </p>

        <div className="share-poster-footer">
          <div className="share-poster-qr">
            <QRCodeSVG value={appUrl} size={88} level="M" includeMargin={false} />
          </div>
          <div className="share-poster-cta">
            <strong>扫码下载识界 App</strong>
            <span>记录你的每一次旅行</span>
          </div>
        </div>

        <div className="share-poster-user">
          @{user?.username || '旅行者'} 的足迹
        </div>
      </div>
    </div>
  );
}
