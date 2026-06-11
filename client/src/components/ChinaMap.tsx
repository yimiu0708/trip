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
  onSelectProvince: (id: number) => void;
}

function buildSeriesData(stats: ProvinceStat[]) {
  return stats.map((s) => ({
    name: s.name,
    value: s.lit_count,
    itemStyle: {
      areaColor: s.lit_count > 0 ? '#22c55e' : '#e2e8f0',
      borderColor: s.lit_count > 0 ? '#16a34a' : '#cbd5e1',
      borderWidth: s.lit_count > 0 ? 1.5 : 1,
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

export default function ChinaMap({ stats, onSelectProvince }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;

    const init = async () => {
      const res = await fetch('/china.json');
      const geoJson = await res.json();
      echarts.registerMap('china', geoJson);

      if (disposed) return;

      const instance = echarts.init(chartRef.current!);
      chartInstance.current = instance;

      instance.on('click', (params: any) => {
        const stat = statsRef.current.find((s) => s.name === params.name);
        if (stat) onSelectProvince(stat.id);
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
            zoom: 1.15,
            center: [105, 36],
            selectedMode: false,
            label: { show: false },
            itemStyle: { areaColor: '#e2e8f0', borderColor: '#cbd5e1', borderWidth: 1 },
            emphasis: {
              itemStyle: { areaColor: '#fde68a' },
              label: { show: true, color: '#0f172a', fontSize: 11, fontWeight: 600 },
            },
            data: buildSeriesData(statsRef.current),
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
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({
      series: [{ type: 'map', map: 'china', data: buildSeriesData(stats) }],
    });
  }, [stats]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
