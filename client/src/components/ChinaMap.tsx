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
      ? { top: 132, right: 22, bottom: 226, left: 22 }
      : { top: 112, right: 84, bottom: 236, left: 28 },
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
          sources: {
            // 风格化底图瓦片：CARTO Voyager 无标签版，色彩更丰富，便于调出青绿色
            'carto-base': {
              type: 'raster',
              tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap &copy; CARTO',
              maxzoom: 18,
            },
            // 地形高程瓦片：Mapzen Terrarium
            'terrain': {
              type: 'raster-dem',
              tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
              tileSize: 256,
              encoding: 'terrarium',
              maxzoom: 15,
            },
          },
          layers: [
            {
              id: 'shijie-map-bg',
              type: 'background',
              paint: {
                'background-color': '#e8f7fc',
              },
            },
            {
              id: 'carto-raster',
              type: 'raster',
              source: 'carto-base',
              paint: {
                'raster-opacity': 0.76,
                'raster-hue-rotate': 155,
                'raster-saturation': 0.25,
                'raster-contrast': 0.12,
                'raster-brightness-min': 0.82,
                'raster-brightness-max': 1.0,
              },
            },
            {
              id: 'hillshade',
              type: 'hillshade',
              source: 'terrain',
              paint: {
                'hillshade-exaggeration': 0.35,
                'hillshade-shadow-color': 'rgba(18, 72, 108, 0.16)',
                'hillshade-highlight-color': 'rgba(255, 255, 255, 0.22)',
                'hillshade-accent-color': 'rgba(18, 199, 217, 0.12)',
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
            'line-color': 'rgba(19, 94, 130, 0.22)',
            'line-width': 8,
            'line-blur': 9,
            'line-opacity': 0.35,
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
                'rgba(30, 207, 224, 0.65)',
                0.45,
                'rgba(67, 217, 168, 0.55)',
                1,
                'rgba(142, 242, 208, 0.45)',
              ],
              'rgba(225, 247, 251, 0.18)',
            ],
            'fill-opacity': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              0.32,
              0.12,
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
            'fill-color': '#18d8ef',
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'lit_rate'],
              0,
              0.05,
              1,
              0.16,
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
              'rgba(255, 255, 255, 0.92)',
              'rgba(120, 180, 205, 0.35)',
            ],
            'line-width': ['case', ['>', ['get', 'lit_count'], 0], 1.6, 0.7],
          },
        });

        // 已点亮省份的发光描边（核心设计稿效果）
        map.addLayer({
          id: 'china-lit-outline',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(23, 216, 236, 0.90)',
            'line-width': 2.6,
            'line-blur': 1.2,
          },
        });

        // 已点亮省份的外层光晕
        map.addLayer({
          id: 'china-lit-outline-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(142, 242, 208, 0.55)',
            'line-width': 10,
            'line-blur': 7,
            'line-opacity': 0.70,
          },
        });

        map.addLayer({
          id: 'china-highlight-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#8ef2d0',
            'line-width': 14,
            'line-opacity': 0.35,
            'line-blur': 10,
          },
        });

        map.addLayer({
          id: 'china-highlight-line',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#ffffff',
            'line-width': 3.2,
          },
        });

        // 省份中心点：外层柔光
        map.addLayer({
          id: 'province-point-glow',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 18, 1, 28],
            'circle-color': 'rgba(22, 207, 232, 0.42)',
            'circle-blur': 0.85,
            'circle-opacity': 0.72,
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
            'circle-stroke-color': 'rgba(255, 255, 255, 0.88)',
            'circle-stroke-width': 2,
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
            'circle-color': '#8ef2d0',
            'circle-opacity': 0.74,
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
            'circle-color': '#12c7d9',
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
            'circle-color': 'rgba(142, 242, 208, 0.36)',
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
