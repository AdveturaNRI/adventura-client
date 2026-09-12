import { createElement, memo, useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CircleMarker, LayerGroup, Map as LeafletMap } from 'leaflet';

import {
  buildClubMarkerHtml,
  CLUB_MARKER_CSS,
  CLUB_MARKER_SIZE,
} from '@/components/map/club-map-marker';
import type { ClubsMapProps } from '@/components/map/clubs-map.types';
import { isFiniteLatLng, toLatLng } from '@/components/map/map-coords';
import {
  MAP_ATTRIBUTION_CSS,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_TILE_OPTIONS,
  MAP_TILE_URL,
} from '@/constants/map.config';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function ensureMapStyles() {
  if (document.getElementById('leaflet-attribution-quiet')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'leaflet-attribution-quiet';
  style.textContent = `${MAP_ATTRIBUTION_CSS}\n${CLUB_MARKER_CSS}`;
  document.head.appendChild(style);
}

const MapWrapper = memo(
  function MapWrapper({ containerId }: { containerId: string }) {
    return createElement('div', {
      id: containerId,
      style: {
        width: '100%',
        height: '100%',
        imageRendering: 'auto',
      },
    });
  },
  () => true,
);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    message: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    messageText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.45,
    },
  });
}

export function ClubsMap({
  style,
  center = MAP_DEFAULT_CENTER,
  zoom = MAP_DEFAULT_ZOOM,
  markers = [],
  focusTarget = null,
  userLocation = null,
  lockCamera = false,
  onMarkerPress,
  onViewChange,
}: ClubsMapProps) {
  const styles = useThemedStyles(createStyles);
  const reactId = useId().replace(/:/g, '');
  const containerId = `osm-map-${reactId}`;
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const userMarkerRef = useRef<CircleMarker | null>(null);
  const onMarkerPressRef = useRef(onMarkerPress);
  const onViewChangeRef = useRef(onViewChange);
  const skipAutoFitRef = useRef(lockCamera);
  const lockCameraRef = useRef(lockCamera);
  onMarkerPressRef.current = onMarkerPress;
  onViewChangeRef.current = onViewChange;
  lockCameraRef.current = lockCamera;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      try {
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        ensureMapStyles();

        const leaflet = await import('leaflet');
        const L = leaflet.default;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        if (cancelled) {
          return;
        }

        const el = document.getElementById(containerId);
        if (!el) {
          setError('Не удалось создать контейнер карты');
          return;
        }

        const safeCenter = toLatLng(center?.[0], center?.[1]);
        const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : MAP_DEFAULT_ZOOM;

        const instance = L.map(el, {
          center: safeCenter,
          zoom: safeZoom,
          zoomControl: false,
        });
        mapRef.current = instance;

        instance.attributionControl?.setPrefix(false);
        L.control.zoom({ position: 'bottomleft' }).addTo(instance);

        L.tileLayer(MAP_TILE_URL, {
          ...MAP_TILE_OPTIONS,
        }).addTo(instance);

        markersLayerRef.current = L.layerGroup().addTo(instance);

        const emitView = () => {
          try {
            const c = instance.getCenter();
            const b = instance.getBounds();
            if (!isFiniteLatLng(c.lat, c.lng)) {
              return;
            }
            onViewChangeRef.current?.({
              center: [c.lat, c.lng],
              zoom: instance.getZoom(),
              bounds: {
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
              },
            });
          } catch {
            // ignore
          }
        };
        instance.on('moveend', emitView);
        instance.on('zoomend', emitView);

        if (cancelled) {
          instance.remove();
          mapRef.current = null;
          markersLayerRef.current = null;
          return;
        }

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            instance.invalidateSize({ animate: false });
          });
          resizeObserver.observe(el);
        }

        requestAnimationFrame(() => {
          if (!cancelled) {
            instance.invalidateSize();
            emitView();
          }
        });
        setMapReady(true);
      } catch {
        if (!cancelled) {
          setError('Не удалось открыть карту');
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      setMapReady(false);
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, containerId]);

  useEffect(() => {
    skipAutoFitRef.current = lockCamera || skipAutoFitRef.current;
    lockCameraRef.current = lockCamera;
  }, [lockCamera]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer || !mapReady) {
      return;
    }

    void import('leaflet')
      .then((leaflet) => {
        const L = leaflet.default;
        layer.clearLayers();

        const validMarkers = markers.filter((m) => isFiniteLatLng(m.lat, m.lng));

        for (const marker of validMarkers) {
          const [lat, lng] = toLatLng(marker.lat, marker.lng);
          try {
            const icon = L.divIcon({
              className: 'club-marker-icon',
              html: buildClubMarkerHtml({
                title: marker.title,
                iconUrl: marker.iconUrl,
                coverUrl: marker.coverUrl,
                accentColor: marker.accentColor,
              }),
              iconSize: [CLUB_MARKER_SIZE.width, CLUB_MARKER_SIZE.height],
              iconAnchor: [CLUB_MARKER_SIZE.anchorX, CLUB_MARKER_SIZE.anchorY],
              popupAnchor: [0, -CLUB_MARKER_SIZE.anchorY + 8],
            });

            const pin = L.marker([lat, lng], { icon });
            if (marker.title) {
              pin.bindPopup(marker.title);
            }
            pin.on('click', () => {
              onMarkerPressRef.current?.(marker.id);
            });
            pin.addTo(layer);
          } catch {
            // пропускаем битый маркер
          }
        }

        if (skipAutoFitRef.current || lockCameraRef.current) {
          skipAutoFitRef.current = false;
          return;
        }

        try {
          if (validMarkers.length === 1) {
            const [lat, lng] = toLatLng(validMarkers[0].lat, validMarkers[0].lng);
            const currentZoom = map.getZoom();
            const nextZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 14) : 14;
            map.setView([lat, lng], nextZoom);
          } else if (validMarkers.length > 1) {
            const bounds = L.latLngBounds(
              validMarkers.map((m) => toLatLng(m.lat, m.lng)),
            );
            map.fitBounds(bounds.pad(0.18));
          }
        } catch {
          // ignore camera fit errors
        }
      })
      .catch(() => {
        // ignore
      });
  }, [markers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusTarget) {
      return;
    }
    if (!isFiniteLatLng(focusTarget.lat, focusTarget.lng)) {
      return;
    }

    const [lat, lng] = toLatLng(focusTarget.lat, focusTarget.lng);
    const nextZoom = Number(focusTarget.zoom ?? 12);
    const zoom = Number.isFinite(nextZoom) ? nextZoom : 12;

    skipAutoFitRef.current = true;
    try {
      map.flyTo([lat, lng], zoom, { duration: 0.75 });
    } catch {
      // Leaflet Invalid LatLng — не роняем экран
    }
  }, [focusTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    void import('leaflet')
      .then((leaflet) => {
        const L = leaflet.default;

        try {
          if (userMarkerRef.current) {
            map.removeLayer(userMarkerRef.current);
            userMarkerRef.current = null;
          }

          if (!userLocation || !isFiniteLatLng(userLocation.lat, userLocation.lng)) {
            return;
          }

          const [lat, lng] = toLatLng(userLocation.lat, userLocation.lng);
          userMarkerRef.current = L.circleMarker([lat, lng], {
            radius: 9,
            color: '#ffffff',
            weight: 2,
            fillColor: '#2F80FF',
            fillOpacity: 1,
          }).addTo(map);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // ignore
      });
  }, [userLocation, mapReady]);

  return (
    <View style={[styles.root, style]}>
      {mounted ? <MapWrapper containerId={containerId} /> : null}
      {error ? (
        <View style={styles.message} pointerEvents="none">
          <Text style={styles.messageText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
