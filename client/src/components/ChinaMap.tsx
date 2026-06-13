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
    ...buildProvinceStyle(s, highlightId),
  }));
}

function buildGeoRegions(stats: ProvinceStat[], highlightId?: number | null) {
  return stats.map((s) => ({
    name: s.name,
    ...buildProvinceStyle(s, highlightId),
  }));
}

function buildProvinceStyle(s: ProvinceStat, highlightId?: number | null) {
  return {
    itemStyle: {
      areaColor: s.lit_count > 0 ? '#35c7b2' : '#d9f2f5',
      borderColor: s.id === highlightId ? '#ffd166' : (s.lit_count > 0 ? '#16a3c7' : '#b8dbe5'),
      borderWidth: s.id === highlightId ? 3 : (s.lit_count > 0 ? 1.5 : 1),
    },
    label: {
      show: false,
    },
    emphasis: {
      itemStyle: { areaColor: s.lit_count > 0 ? '#21b9d0' : '#c5edf2' },
      label: { show: true, color: '#fff', fontSize: 12, fontWeight: 600 },
    },
  };
}

const DEFAULT_CENTER: [number, number] = [105, 36];
const DEFAULT_ZOOM = 1.15;
const FOCUS_ZOOM = 3;

export default function ChinaMap({ stats, onClickProvince, onDoubleClickProvince, highlightProvinceId }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const geoJsonRef = useRef<any>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHighlightId = useRef<number | null | undefined>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;

    const init = async () => {
      const res = await fetch('/china.json');
      const geoJson = await res.json();
      geoJsonRef.current = geoJson;
      echarts.registerMap('china', geoJson);

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
              ? `已点亮 ${stat.lit_count}/${stat.total_count}`
              : '未点亮';
            const statusColor = stat.lit_count > 0 ? '#0ba7a3' : '#7890a2';
            return `<div style="font-weight:600">${params.name}</div><div style="font-size:12px;margin-top:4px;color:${statusColor}">${status}</div>`;
          },
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderColor: '#e2e8f0',
          textStyle: { color: '#1e293b' },
          padding: 12,
        },
        geo: {
          map: 'china',
          roam: true,
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          label: { show: false },
          itemStyle: { areaColor: '#d9f2f5', borderColor: '#b8dbe5', borderWidth: 1 },
          regions: buildGeoRegions(statsRef.current, highlightProvinceId),
          emphasis: {
            itemStyle: { areaColor: '#8be2cf' },
            label: { show: true, color: '#0f172a', fontSize: 11, fontWeight: 600 },
          },
        },
        series: [
          {
            type: 'map',
            coordinateSystem: 'geo',
            geoIndex: 0,
            selectedMode: false,
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

  useEffect(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({
      geo: {
        regions: buildGeoRegions(stats, highlightProvinceId),
      },
      series: [{ type: 'map', coordinateSystem: 'geo', geoIndex: 0, data: buildSeriesData(stats, highlightProvinceId) }],
    });
  }, [stats, highlightProvinceId]);

  useEffect(() => {
    if (!chartInstance.current || highlightProvinceId === prevHighlightId.current) return;
    prevHighlightId.current = highlightProvinceId;

    const chart = chartInstance.current;
    if (highlightProvinceId) {
      const stat = statsRef.current.find((s) => s.id === highlightProvinceId);
      if (!stat) return;

      let center: [number, number] | undefined;

      const feature = geoJsonRef.current?.features?.find(
        (f: any) => f.properties?.name === stat.name
      );
      if (feature?.properties?.center) {
        center = feature.properties.center;
      } else {
        const model = (chart as any).getModel();
        const seriesModel = model?.getSeries?.()?.[0];
        const region = seriesModel?.coordinateSystem?.getRegion?.(stat.name);
        center = region?.center as [number, number] | undefined;
      }

      if (!center) return;

      chart.setOption({
        geo: {
          center,
          zoom: FOCUS_ZOOM,
          animationDurationUpdate: 800,
          animationEasingUpdate: 'cubicOut',
        },
      });
    } else {
      chart.setOption({
        geo: {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          animationDurationUpdate: 800,
          animationEasingUpdate: 'cubicOut',
        },
      });
    }
  }, [highlightProvinceId]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
