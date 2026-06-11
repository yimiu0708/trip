import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ProvinceStat {
  id: number;
  name: string;
  lit_count: number;
  total_count: number;
  region: string;
}

interface Props {
  stats: ProvinceStat[];
  onClickProvince: (id: number) => void;
  onDoubleClickProvince: (id: number) => void;
  highlightProvinceId?: number | null;
}

function buildSeriesData(stats: ProvinceStat[], highlightId?: number | null) {
  return stats.map((s) => ({
    name: s.name,
    value: s.lit_count,
    itemStyle: {
      areaColor: s.lit_count > 0 ? '#22c55e' : '#e2e8f0',
      borderColor: s.id === highlightId ? '#f59e0b' : (s.lit_count > 0 ? '#16a34a' : '#cbd5e1'),
      borderWidth: s.id === highlightId ? 3 : (s.lit_count > 0 ? 1.5 : 1),
    },
    label: {
      show: false,
    },
    emphasis: {
      itemStyle: { areaColor: s.lit_count > 0 ? '#16a34a' : '#cbd5e1' },
      label: { show: true, color: '#fff', fontSize: 12, fontWeight: 600 },
    },
  }));
}

/** 计算 GeoJSON feature 的 bounding box 中心 */
function getFeatureCenter(feature: any): [number, number] | null {
  const geom = feature.geometry;
  if (!geom) return null;

  const coords: number[][][] = [];
  if (geom.type === 'Polygon') {
    coords.push(geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach((poly: any) => coords.push(poly[0]));
  } else {
    return null;
  }

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  coords.forEach((ring: number[][]) => {
    ring.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
  });

  if (minLng === Infinity) return null;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

const DEFAULT_CENTER: [number, number] = [105, 36];
const DEFAULT_ZOOM = 1.15;
const FOCUS_ZOOM = 3.5;

export default function ChinaMap({ stats, onClickProvince, onDoubleClickProvince, highlightProvinceId }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centersRef = useRef<Record<string, [number, number]>>({});
  const prevHighlightRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;

    const init = async () => {
      const res = await fetch('/china.json');
      const geoJson = await res.json();
      echarts.registerMap('china', geoJson);

      // 预计算每个省份的中心坐标
      const centers: Record<string, [number, number]> = {};
      geoJson.features?.forEach((feature: any) => {
        const name = feature.properties?.name;
        const center = getFeatureCenter(feature);
        if (name && center) centers[name] = center;
      });
      centersRef.current = centers;

      if (disposed) return;

      const instance = echarts.init(chartRef.current!);
      chartInstance.current = instance;

      instance.on('click', (params: any) => {
        const stat = statsRef.current.find((s) => s.name === params.name);
        if (!stat) return;

        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          onDoubleClickProvince(stat.id);
        } else {
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onClickProvince(stat.id);
          }, 250);
        }
      });

      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const stat = statsRef.current.find((s) => s.name === params.name);
            if (!stat) return params.name;
            const status = stat.lit_count > 0
              ? `✅ 已点亮 (${stat.lit_count}/${stat.total_count})`
              : '⬜ 未点亮';
            return `<div style="font-weight:600">${params.name}</div><div style="font-size:12px;margin-top:4px">${status}</div>`;
          },
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderColor: '#e2e8f0',
          textStyle: { color: '#1e293b' },
          padding: 12,
        },
        series: [
          {
            type: 'map',
            map: 'china',
            roam: true,
            zoom: DEFAULT_ZOOM,
            center: DEFAULT_CENTER,
            selectedMode: false,
            label: { show: false },
            itemStyle: { areaColor: '#e2e8f0', borderColor: '#cbd5e1', borderWidth: 1 },
            emphasis: {
              itemStyle: { areaColor: '#fde68a' },
              label: { show: true, color: '#0f172a', fontSize: 11, fontWeight: 600 },
            },
            data: buildSeriesData(statsRef.current, highlightProvinceId),
          },
        ],
      });

      const handleResize = () => instance.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        instance.dispose();
        chartInstance.current = null;
      };
    };

    const cleanupPromise = init();
    return () => {
      disposed = true;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据/高亮变化时更新 series
  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({
      series: [{ type: 'map', map: 'china', data: buildSeriesData(stats, highlightProvinceId) }],
    });
  }, [stats, highlightProvinceId]);

  // 省份聚焦/恢复：单击放大，取消选中恢复全图
  useEffect(() => {
    if (!chartInstance.current) return;
    const chart = chartInstance.current;

    if (highlightProvinceId) {
      // 聚焦到选中省份
      const stat = stats.find((s) => s.id === highlightProvinceId);
      const center = stat ? centersRef.current[stat.name] : null;
      if (center) {
        chart.setOption({
          series: [{
            center,
            zoom: FOCUS_ZOOM,
            animationDurationUpdate: 700,
            animationEasingUpdate: 'cubicOut',
          }],
        });
      }
    } else if (prevHighlightRef.current !== null) {
      // 从有选中变为无选中，恢复全图
      chart.setOption({
        series: [{
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          animationDurationUpdate: 700,
          animationEasingUpdate: 'cubicOut',
        }],
      });
    }

    prevHighlightRef.current = highlightProvinceId ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightProvinceId]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
