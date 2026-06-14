import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent, type Marker } from 'maplibre-gl';
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
  const selectedLabelRef = useRef<Marker | null>(null);
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

        map.addSource('china-provinces', { type: 'geojson', data: provinceData });

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
                'rgba(148, 231, 219, 0.42)',
                0.45,
                'rgba(122, 224, 213, 0.46)',
                1,
                'rgba(117, 238, 205, 0.50)',
              ],
              'rgba(247, 253, 255, 0.82)',
            ],
            'fill-opacity': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              0.54,
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
            'fill-color': '#b8f6e9',
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'lit_rate'],
              0,
              0.08,
              1,
              0.18,
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
            'line-color': 'rgba(60, 209, 204, 0.60)',
            'line-width': 1.35,
            'line-blur': 0.35,
          },
        });

        // 已点亮省份的外层光晕
        map.addLayer({
          id: 'china-lit-outline-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(126, 240, 214, 0.30)',
            'line-width': 5.5,
            'line-blur': 8,
            'line-opacity': 0.42,
          },
        });

        map.addLayer({
          id: 'china-highlight-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': 'rgba(31, 204, 211, 0.42)',
            'line-width': 13,
            'line-opacity': 0.80,
            'line-blur': 7,
          },
        });

        map.addLayer({
          id: 'china-highlight-fill',
          type: 'fill',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'fill-color': 'rgba(50, 214, 218, 0.28)',
            'fill-opacity': 0.36,
          },
        });

        map.addLayer({
          id: 'china-highlight-line',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#20c8cf',
            'line-width': 4.8,
            'line-blur': 0.15,
          },
        });

        map.addLayer({
          id: 'china-highlight-inner-line',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#ffffff',
            'line-width': 2.15,
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

      ['china-fill'].forEach((layerId) => {
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
          layers: ['china-fill'],
        });
        if (features.length === 0) {
          callbacksRef.current.onClickEmpty?.();
        }
      });
    };

    init();

    return () => {
      disposed = true;
      selectedLabelRef.current?.remove();
      selectedLabelRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const geoJson = geoJsonRef.current;
    if (!map || !geoJson || !map.isStyleLoaded()) return;

    const provinceSource = map.getSource('china-provinces') as GeoJSONSource | undefined;
    provinceSource?.setData(enrichProvinceGeoJson(geoJson, stats) as any);
  }, [stats]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const filter = ['==', ['get', 'stat_id'], highlightProvinceId || -1] as any;
    if (map.getLayer('china-highlight-glow')) map.setFilter('china-highlight-glow', filter);
    if (map.getLayer('china-highlight-fill')) map.setFilter('china-highlight-fill', filter);
    if (map.getLayer('china-highlight-line')) map.setFilter('china-highlight-line', filter);
    if (map.getLayer('china-highlight-inner-line')) map.setFilter('china-highlight-inner-line', filter);

    if (highlightedStat && geoJsonRef.current) {
      selectedLabelRef.current?.remove();
      selectedLabelRef.current = null;
      const feature = geoJsonRef.current.features?.find((item: any) => item.properties?.name === highlightedStat.name);
      const center = feature?.properties?.center;
      if (center) {
        const label = document.createElement('div');
        label.className = 'province-selected-map-label';
        label.textContent = highlightedStat.name;
        selectedLabelRef.current = new maplibregl.Marker({
          element: label,
          anchor: 'top',
          offset: [0, 28],
        })
          .setLngLat(center)
          .addTo(map);
        // 单击省份：缓慢放大，营造聚焦感
        map.flyTo({ center, zoom: 4.55, duration: 1200, essential: true, curve: 1.2 });
      }
    } else {
      selectedLabelRef.current?.remove();
      selectedLabelRef.current = null;
      fitChina(map, true);
    }
  }, [highlightProvinceId, highlightedStat]);

  return <div className="china-map-canvas" ref={mapNodeRef} />;
}
