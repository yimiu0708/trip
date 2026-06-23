import { forwardRef, useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api/client';
import type { PersonalityResult } from '../../lib/personality';

interface ShareData extends PersonalityResult {
  stats: { litProvinces: number; litCities: number; litAttractions: number };
  newAchievements?: Array<{ id: number; name: string }>;
}

export default function PersonalitySharePoster({ result, onClose, onAchievements }: {
  result: PersonalityResult;
  onClose: () => void;
  onAchievements: (items: Array<{ id: number; name: string }>) => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ShareData | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.personality.shareCard()
      .then((payload) => {
        setData(payload);
        onAchievements(payload.newAchievements || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '海报数据加载失败'));
  }, [onAchievements]);

  useEffect(() => {
    if (!data || !sourceRef.current) return;
    const timer = window.setTimeout(() => {
      waitForPosterAssets(sourceRef.current!).then(() => toPng(sourceRef.current!, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#eef8f8',
        width: 420,
        height: 720,
        style: { position: 'relative', left: '0', top: '0' },
      }))
        .then(setImageUrl)
        .catch(() => setError('海报生成失败，请重试'));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [data]);

  const save = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `识界旅行人格-${result.typeCode}.png`;
    link.click();
  };

  const share = async () => {
    if (!imageUrl) return;
    try {
      const blob = await fetch(imageUrl).then((response) => response.blob());
      const file = new File([blob], `识界旅行人格-${result.typeCode}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `我的旅行人格是 ${result.typeCode} ${result.typeName}`, files: [file] });
        return;
      }
    } catch {
      // Download is the supported fallback on browsers without file sharing.
    }
    save();
  };

  return (
    <div className="modal-overlay personality-poster-overlay" onClick={onClose}>
      <div className="personality-poster-dialog" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="personality-poster-close" onClick={onClose} aria-label="关闭海报"><X size={18} /></button>
        <h2>我的旅行人格海报</h2>
        <div className="personality-poster-preview">
          {imageUrl
            ? <img src={imageUrl} alt={`${result.typeCode} ${result.typeName} 分享海报`} />
            : data
              ? <PosterArtwork ref={sourceRef} data={data} preview />
              : <span>{error || '正在加载海报数据...'}</span>}
        </div>
        <div className="personality-poster-actions">
          <button type="button" onClick={save} disabled={!imageUrl}><Download size={16} />保存图片</button>
          <button type="button" className="primary" onClick={share} disabled={!imageUrl}><Share2 size={16} />分享</button>
        </div>
      </div>
    </div>
  );
}

const PosterArtwork = forwardRef<HTMLDivElement, { data: ShareData; preview?: boolean }>(function PosterArtwork({ data, preview = false }, ref) {
  const origin = typeof window === 'undefined' ? 'https://shijie.app' : window.location.origin;
  return (
    <div ref={ref} className={`personality-poster-artwork${preview ? ' preview' : ''}`} aria-hidden="true">
      <header><img src="/images/shijie-logo-mark.png" alt="" /><div><strong>识界</strong><span>Light your life</span></div></header>
      <p>我的旅行人格是</p>
      <div className="personality-poster-code">{data.typeCode}</div>
      <h2>{data.typeName}</h2>
      <blockquote>{data.summary}</blockquote>
      <div className="personality-poster-dimensions">{data.dimensionLabels.map((label) => <span key={label}>{label}</span>)}</div>
      <div className="personality-poster-stats">
        <span><strong>{data.stats.litProvinces}</strong>省份</span>
        <span><strong>{data.stats.litCities}</strong>城市</span>
        <span><strong>{data.stats.litAttractions}</strong>景区</span>
      </div>
      <footer><div><QRCodeSVG value={`${origin}/personality/test`} size={74} /></div><p>来识界<br />点亮你的旅行地图</p></footer>
    </div>
  );
});

async function waitForPosterAssets(node: HTMLElement) {
  await document.fonts?.ready;
  await Promise.all(Array.from(node.querySelectorAll('img')).map((image) => image.decode?.().catch(() => undefined)));
}
