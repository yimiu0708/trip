import { useEffect, useRef } from 'react';
import { echarts, type ECharts } from '../lib/echarts';

interface Props {
  provinceName: string;
}

export default function ProvinceOutlineMap({ provinceName }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    let disposed = false;
    let chart: ECharts | null = null;

    const init = async () => {
      const res = await fetch('/china.json');
      const geoJson = await res.json();
      if (disposed || !chartRef.current) return;

      const feature = geoJson.features?.find((item: any) => item.properties?.name === provinceName);
      const outlineJson = feature
        ? { type: 'FeatureCollection', features: [feature] }
        : geoJson;
      echarts.registerMap(`province-outline-${provinceName}`, outlineJson);
      chart = echarts.init(chartRef.current);

      chart.setOption({
        backgroundColor: 'transparent',
        geo: {
          map: `province-outline-${provinceName}`,
          roam: false,
          silent: true,
          zoom: 1,
          label: { show: false },
          itemStyle: {
            areaColor: 'rgba(18,199,217,0.42)',
            borderColor: 'rgba(255,255,255,0.95)',
            borderWidth: 2.2,
            shadowBlur: 22,
            shadowColor: 'rgba(18,199,217,0.62)',
          },
          emphasis: { disabled: true },
        },
        series: [],
      });

      const resize = () => chart?.resize();
      window.addEventListener('resize', resize);
      return () => {
        window.removeEventListener('resize', resize);
        chart?.dispose();
      };
    };

    const cleanupPromise = init();
    return () => {
      disposed = true;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [provinceName]);

  return <div className="province-outline-map" ref={chartRef} aria-hidden="true" />;
}
