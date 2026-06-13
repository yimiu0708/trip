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
  onDoubleClickProvince: (id: number) => void;
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

export default function ChinaMap({ stats, onClickProvince, onDoubleClickProvince, highlightProvinceId }: Props) {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoJsonRef = useRef<any>(null);
  const statsRef = useRef(stats);
  const highlightIdRef = useRef(highlightProvinceId);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onClickProvince, onDoubleClickProvince });

  statsRef.current = stats;
  highlightIdRef.current = highlightProvinceId;
  callbacksRef.current = { onClickProvince, onDoubleClickProvince };

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
        doubleClickZoom: false,
        center: [105, 36],
        zoom: 3.15,
        minZoom: 2.2,
        maxZoom: 7,
        pitch: 0,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'shijie-map-bg',
              type: 'background',
              paint: {
                'background-color': 'rgba(232, 248, 252, 0)',
              },
            },
          ],
        },
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        if (disposed) return;
        const provinceData = enrichProvinceGeoJson(geoJson, statsRef.current);
        const pointData = buildPointGeoJson(geoJson, statsRef.current);

        map.addSource('china-provinces', { type: 'geojson', data: provinceData });
        map.addSource('province-points', { type: 'geojson', data: pointData });

        map.addLayer({
          id: 'china-shadow',
          type: 'line',
          source: 'china-provinces',
          paint: {
            'line-color': 'rgba(18, 91, 130, 0.10)',
            'line-width': 4,
            'line-blur': 3,
            'line-opacity': 0.42,
          },
        });

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
                '#23c2d5',
                0.45,
                '#35c98b',
                1,
                '#8ef2d0',
              ],
              'rgba(225, 245, 249, 0.70)',
            ],
            'fill-opacity': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              0.84,
              0.70,
            ],
          },
        });

        map.addLayer({
          id: 'china-fill-shine',
          type: 'fill',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'fill-color': '#8ef2d0',
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'lit_rate'],
              0,
              0.08,
              1,
              0.26,
            ],
          },
        });

        map.addLayer({
          id: 'china-outline',
          type: 'line',
          source: 'china-provinces',
          paint: {
            'line-color': [
              'case',
              ['>', ['get', 'lit_count'], 0],
              'rgba(255, 255, 255, 0.92)',
              'rgba(122, 173, 193, 0.42)',
            ],
            'line-width': ['case', ['>', ['get', 'lit_count'], 0], 1.35, 0.78],
          },
        });

        map.addLayer({
          id: 'china-lit-outline',
          type: 'line',
          source: 'china-provinces',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'line-color': 'rgba(18, 199, 217, 0.88)',
            'line-width': 1.3,
            'line-blur': 0.4,
          },
        });

        map.addLayer({
          id: 'china-highlight-glow',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#ffc85a',
            'line-width': 12,
            'line-opacity': 0.34,
            'line-blur': 8,
          },
        });

        map.addLayer({
          id: 'china-highlight-line',
          type: 'line',
          source: 'china-provinces',
          filter: ['==', ['get', 'stat_id'], highlightIdRef.current || -1],
          paint: {
            'line-color': '#ffc85a',
            'line-width': 3.4,
          },
        });

        map.addLayer({
          id: 'province-point-glow',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 18, 1, 30],
            'circle-color': 'rgba(18, 199, 217, 0.42)',
            'circle-blur': 0.88,
            'circle-opacity': 0.86,
          },
        });

        map.addLayer({
          id: 'province-point-ring',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 9, 1, 14],
            'circle-color': 'rgba(255,255,255,0)',
            'circle-stroke-color': 'rgba(255, 255, 255, 0.92)',
            'circle-stroke-width': 2,
            'circle-opacity': 0.92,
          },
        });

        map.addLayer({
          id: 'province-point-aura',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 5, 1, 8],
            'circle-color': '#8ef2d0',
            'circle-opacity': 0.82,
          },
        });

        map.addLayer({
          id: 'province-point-core',
          type: 'circle',
          source: 'province-points',
          filter: ['>', ['get', 'lit_count'], 0],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'lit_rate'], 0, 3.4, 1, 5.8],
            'circle-color': '#12c7d9',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.98,
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

        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          callbacksRef.current.onDoubleClickProvince(stat.id);
          return;
        }

        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          callbacksRef.current.onClickProvince(stat.id);
        }, 240);
      };

      const handleDoubleClick = (event: MapLayerMouseEvent) => {
        event.preventDefault?.();
        const stat = pickStat(event);
        if (!stat) return;
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        }
        callbacksRef.current.onDoubleClickProvince(stat.id);
      };

      ['china-fill', 'province-point-core'].forEach((layerId) => {
        map.on('click', layerId, handleClick);
        map.on('dblclick', layerId, handleDoubleClick);
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    };

    init();

    return () => {
      disposed = true;
      if (clickTimer.current) clearTimeout(clickTimer.current);
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

    if (highlightedStat && geoJsonRef.current) {
      const feature = geoJsonRef.current.features?.find((item: any) => item.properties?.name === highlightedStat.name);
      const center = feature?.properties?.center;
      if (center) {
        map.flyTo({ center, zoom: 4.55, duration: 650, essential: true });
      }
    } else {
      fitChina(map, true);
    }
  }, [highlightProvinceId, highlightedStat]);

  return <div className="china-map-canvas" ref={mapNodeRef} />;
}
