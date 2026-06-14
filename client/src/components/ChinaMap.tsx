import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  onClickEmpty?: () => void;
  highlightProvinceId?: number | null;
}

const CHINA_BOUNDS: [[number, number], [number, number]] = [[72, 17], [136, 55]];

function enrichProvinceGeoJson(geoJson: any, stats: ProvinceStat[]) {
  const statMap = new Map(stats.map((stat) => [stat.name, stat]));
  return {
    ...geoJson,
    features: (geoJson.features || []).map((feature: any) => {
      const name = feature.properties?.name;
      const stat = statMap.get(name);
      const total = stat?.total_count || 0;
      const lit = stat?.lit_count || 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          stat_id: stat?.id || 0,
          lit_count: lit,
          total_count: total,
          lit_rate: total > 0 ? lit / total : 0,
        },
      };
    }),
  };
}

function buildPointGeoJson(geoJson: any, stats: ProvinceStat[]) {
  const statMap = new Map(stats.map((stat) => [stat.name, stat]));
  return {
    type: 'FeatureCollection',
    features: (geoJson?.features || [])
      .map((feature: any) => {
        const name = feature.properties?.name;
        const center = feature.properties?.center;
        const stat = statMap.get(name);
        if (!center || !stat) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: center },
          properties: {
            name,
            stat_id: stat.id,
            lit_count: stat.lit_count,
            total_count: stat.total_count,
            lit_rate: stat.total_count > 0 ? stat.lit_count / stat.total_count : 0,
          },
        };
      })
      .filter(Boolean),
  };
}

function fitChina(map: MapLibreMap, animate = false) {
  const narrow = window.innerWidth <= 520;
  map.fitBounds(CHINA_BOUNDS, {
    padding: narrow
      ? { top: 174, right: 18, bottom: 234, left: 18 }
      : { top: 158, right: 100, bottom: 252, left: 42 },
    duration: animate ? 650 : 0,
  });
}

export default function ChinaMap({ stats, onClickProvince, onClickEmpty, highlightProvinceId }: Props) {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoJsonRef = useRef<any>(null);
  const statsRef = useRef(stats);
  const highlightIdRef = useRef(highlightProvinceId);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onClickProvince, onClickEmpty });

  statsRef.current = stats;
  highlightIdRef.current = highlightProvinceId;
  callbacksRef.current = { onClickProvince, onClickEmpty };

  const highlightedStat = useMemo(
    () => stats.find((stat) => stat.id === highlightProvinceId) || null,
    [highlightProvinceId, stats],
  );

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    let disposed = false;

    const init = async () => {
      const res = await fetch('/china.json');
      const geoJson = await res.json();
      geoJsonRef.current = geoJson;
      if (disposed || !mapNodeRef.current) return;

      const map = new maplibregl.Map({
        container: mapNodeRef.current,
        attributionControl: false,
        // 该页面地图只做单击放大交互，禁用自由拖拽/缩放
        dragPan: false,
        scrollZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoomRotate: false,
        center: [105, 36],
        zoom: 3.05,
        minZoom: 2.2,
        maxZoom: 6,
        pitch: 0,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'shijie-map-bg',
              type: 'background',
              paint: {
                'background-color': 'rgba(231, 248, 252, 0)',
              },
            },
          ],
        },
      });

      mapRef.current = map;
      // 该页面不需要缩放控件
      // map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        if (disposed) return;
        const provinceData = enrichProvinceGeoJson(geoJson, statsRef.current);
        const pointData = buildPointGeoJson(geoJson, statsRef.current);

        map.addSource('china-provinces', { type: 'geojson', data: provinceData });
        map.addSource('province-points', { type: 'geojson', data: pointData });

        // 柔和的国家轮廓阴影，让地图从背景中微微浮起
        map.addLayer({
          id: 'china-shadow',
          type: 'line',
          source: 'china-provinces',
          paint: {
            'line-color': 'rgba(79, 154, 185, 0.18)',
            'line-width': 5,
            'line-blur': 7,
            'line-opacity': 0.26,
          },
        });

        // 极淡的省份填充：未点亮时几乎透明，仅用来统一色调
        map.addLayer({
          id: 'china-fill',
          type: 'fill',
          source: 'china-provinces',
          paint: {
            'fill-color': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              [
                'interpolate',
                ['linear'],
                ['get', 'lit_rate'],
                0,
                'rgba(78, 204, 198, 0.56)',
                0.45,
                'rgba(127, 214, 211, 0.50)',
                1,
                'rgba(142, 242, 208, 0.44)',
              ],
              'rgba(247, 253, 255, 0.82)',
            ],
            'fill-opacity': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              0.48,
              0.82,
            ],
          },
        });

        // 已点亮省份的柔和泛光填充
        map.addLayer({
          id: 'china-lit-glow-fill',
          type: 'fill',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'fill-color': '#8EF2D0',
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'lit_rate'],
              0,
              0.12,
              1,
              0.22,
            ],
          },
        });

        // 省份基础描边：未点亮时极淡，点亮时变白
        map.addLayer({
          id: 'china-outline',
          type: 'line',
          source: 'china-provinces',
          paint: {
            'line-color': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              'rgba(255, 255, 255, 0.82)',
              'rgba(111, 179, 204, 0.36)',
            ],
            'line-width': ['case', ['>', ['get', 'lit_count'], 0], 1.05, 0.58],
          },
        });

        // 已点亮省份的发光描边（核心设计稿效果）
        map.addLayer({
          id: 'china-lit-outline',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(18, 199, 217, 0.72)',
            'line-width': 1.7,
            'line-blur': 0.7,
          },
        });

        // 已点亮省份的外层光晕
        map.addLayer({
          id: 'china-lit-outline-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(142, 242, 208, 0.46)',
            'line-width': 7,
            'line-blur': 9,
            'line-opacity': 0.56,
          },
        });

        map.addLayer({
          id: 'china-highlight-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': 'rgba(18, 199, 217, 0.34)',
            'line-width': 10,
            'line-opacity': 0.46,
            'line-blur': 11,
          },
        });

        map.addLayer({
          id: 'china-highlight-line',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#ffffff',
            'line-width': 2.2,
          },
        });

        // 省份中心点：外层柔光
        map.addLayer({
          id: 'province-point-glow',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 17, 1, 25],
            'circle-color': 'rgba(18, 199, 217, 0.30)',
            'circle-blur': 0.85,
            'circle-opacity': 0.66,
          },
        });

        // 白色描边圆环
        map.addLayer({
          id: 'province-point-ring',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 8, 1, 12],
            'circle-color': 'rgba(255,255,255,0)',
            'circle-stroke-color': 'rgba(255, 255, 255, 0.92)',
            'circle-stroke-width': 2.4,
            'circle-opacity': 0.88,
          },
        });

        // 内层 aura
        map.addLayer({
          id: 'province-point-aura',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 4.5, 1, 7],
            'circle-color': '#8EF2D0',
            'circle-opacity': 0.78,
          },
        });

        // 中心实心点
        map.addLayer({
          id: 'province-point-core',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 3, 1, 5],
            'circle-color': '#12C7D9',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.4,
            'circle-opacity': 0.96,
          },
        });

        map.addLayer({
          id: 'province-selected-pulse',
          type: 'circle',
          source: 'province-points',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'circle-radius': 20,
            'circle-color': 'rgba(18, 199, 217, 0.30)',
            'circle-blur': 0.70,
            'circle-opacity': 0.58,
          },
        });

        map.addLayer({
          id: 'province-selected-ring',
          type: 'circle',
          source: 'province-points',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'circle-radius': 13,
            'circle-color': 'rgba(255,255,255,0)',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.6,
            'circle-opacity': 0.96,
          },
        });

        fitChina(map);
      });

      const pickStat = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = Number(feature?.properties?.stat_id);
        return statsRef.current.find((stat) => stat.id === id) || null;
      };

      const handleClick = (event: MapLayerMouseEvent) => {
        const stat = pickStat(event);
        if (!stat) return;
        callbacksRef.current.onClickProvince(stat.id);
      };

      ['china-fill', 'province-point-core'].forEach((layerId) => {
        map.on('click', layerId, handleClick);
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      map.on('click', (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['china-fill', 'province-point-core'],
        });
        if (features.length === 0) {
          callbacksRef.current.onClickEmpty?.();
        }
      });
    };

    init();

    return () => {
      disposed = true;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const geoJson = geoJsonRef.current;
    if (!map || !geoJson || !map.isStyleLoaded()) return;

    const provinceSource = map.getSource('china-provinces') as GeoJSONSource | undefined;
    const pointSource = map.getSource('province-points') as GeoJSONSource | undefined;
    provinceSource?.setData(enrichProvinceGeoJson(geoJson, stats) as any);
    pointSource?.setData(buildPointGeoJson(geoJson, stats) as any);
  }, [stats]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const filter = ['==', ['get', 'stat_id'], highlightProvinceId || -1] as any;
    if (map.getLayer('china-highlight-glow')) map.setFilter('china-highlight-glow', filter);
    if (map.getLayer('china-highlight-line')) map.setFilter('china-highlight-line', filter);
    if (map.getLayer('province-selected-pulse')) map.setFilter('province-selected-pulse', filter);
    if (map.getLayer('province-selected-ring')) map.setFilter('province-selected-ring', filter);

    if (pulseFrameRef.current) {
      cancelAnimationFrame(pulseFrameRef.current);
      pulseFrameRef.current = null;
    }

    if (highlightProvinceId && map.getLayer('province-selected-pulse')) {
      const startedAt = performance.now();
      const animatePulse = (now: number) => {
        if (!mapRef.current || !mapRef.current.getLayer('province-selected-pulse')) return;
        const progress = ((now - startedAt) % 1600) / 1600;
        const radius = 18 + progress * 20;
        const opacity = 0.56 * (1 - progress);
        mapRef.current.setPaintProperty('province-selected-pulse', 'circle-radius', radius);
        mapRef.current.setPaintProperty('province-selected-pulse', 'circle-opacity', opacity);
        pulseFrameRef.current = requestAnimationFrame(animatePulse);
      };
      pulseFrameRef.current = requestAnimationFrame(animatePulse);
    }

    if (highlightedStat && geoJsonRef.current) {
      const feature = geoJsonRef.current.features?.find((item: any) => item.properties?.name === highlightedStat.name);
      const center = feature?.properties?.center;
      if (center) {
        // 单击省份：缓慢放大，营造聚焦感
        map.flyTo({ center, zoom: 4.55, duration: 1200, essential: true, curve: 1.2 });
      }
    } else {
      fitChina(map, true);
    }
  }, [highlightProvinceId, highlightedStat]);

  return <div className="china-map-canvas" ref={mapNodeRef} />;
}
