import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

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
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

// Strict RN WebView typings break ref + injectJavaScript in this setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapWebView = WebView as any;

function buildMapHtml(
  center: [number, number],
  zoom: number,
  markers: ClubsMapProps['markers'],
  lockCamera: boolean,
) {
  const [lat, lng] = toLatLng(center[0], center[1]);
  const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : MAP_DEFAULT_ZOOM;
  const markersPayload = (markers ?? [])
    .filter((m) => isFiniteLatLng(m.lat, m.lng))
    .map((m) => {
      const [mLat, mLng] = toLatLng(m.lat, m.lng);
      return {
        id: m.id,
        lat: mLat,
        lng: mLng,
        title: m.title ?? null,
        html: buildClubMarkerHtml({
          title: m.title,
          iconUrl: m.iconUrl,
          coverUrl: m.coverUrl,
          accentColor: m.accentColor,
        }),
      };
    });
  const markersJson = JSON.stringify(markersPayload);
  const iconW = CLUB_MARKER_SIZE.width;
  const iconH = CLUB_MARKER_SIZE.height;
  const anchorX = CLUB_MARKER_SIZE.anchorX;
  const anchorY = CLUB_MARKER_SIZE.anchorY;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; width: 100%; height: 100%; background: #e8eef5; }
    ${MAP_ATTRIBUTION_CSS}
    ${CLUB_MARKER_CSS}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function isFiniteLatLng(lat, lng) {
      return typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng);
    }
    var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], ${safeZoom});
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer(${JSON.stringify(MAP_TILE_URL)}, ${JSON.stringify(MAP_TILE_OPTIONS)}).addTo(map);
    var markers = ${markersJson};
    var lockCamera = ${lockCamera ? 'true' : 'false'};
    var group = L.layerGroup().addTo(map);
    var userMarker = null;
    markers.forEach(function (m) {
      if (!isFiniteLatLng(m.lat, m.lng)) return;
      var icon = L.divIcon({
        className: 'club-marker-icon',
        html: m.html,
        iconSize: [${iconW}, ${iconH}],
        iconAnchor: [${anchorX}, ${anchorY}],
        popupAnchor: [0, ${-anchorY + 8}]
      });
      try {
        var pin = L.marker([m.lat, m.lng], { icon: icon }).addTo(group);
        if (m.title) pin.bindPopup(m.title);
        pin.on('click', function () {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
          }
        });
      } catch (e) {}
    });
    if (!lockCamera) {
      try {
        if (markers.length === 1) {
          map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom() || 12, 14));
        } else if (markers.length > 1) {
          map.fitBounds(L.latLngBounds(markers.map(function (m) { return [m.lat, m.lng]; })).pad(0.18));
        }
      } catch (e) {}
    }
    function emitView() {
      var c = map.getCenter();
      var b = map.getBounds();
      if (!isFiniteLatLng(c.lat, c.lng)) return;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'view',
          lat: c.lat,
          lng: c.lng,
          zoom: map.getZoom(),
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        }));
      }
    }
    map.on('moveend', emitView);
    map.on('zoomend', emitView);
    window.__flyTo = function (lat, lng, zoom) {
      if (!isFiniteLatLng(lat, lng)) return;
      try { map.flyTo([lat, lng], zoom || 12, { duration: 0.75 }); } catch (e) {}
    };
    window.__setUserLocation = function (lat, lng) {
      if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
      if (!isFiniteLatLng(lat, lng)) return;
      try {
        userMarker = L.circleMarker([lat, lng], {
          radius: 9, color: '#ffffff', weight: 2, fillColor: '#2F80FF', fillOpacity: 1
        }).addTo(map);
      } catch (e) {}
    };
    setTimeout(function () { map.invalidateSize(); emitView(); }, 80);
  </script>
</body>
</html>`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
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
  const webRef = useRef<{ injectJavaScript?: (script: string) => void } | null>(null);
  const html = useMemo(
    () => buildMapHtml(center, zoom, markers, lockCamera),
    // markers rebuild remounts — ok for native
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center, zoom, JSON.stringify(markers), lockCamera],
  );

  useEffect(() => {
    if (!focusTarget || !isFiniteLatLng(focusTarget.lat, focusTarget.lng)) {
      return;
    }
    const [lat, lng] = toLatLng(focusTarget.lat, focusTarget.lng);
    const z = Number(focusTarget.zoom ?? 12);
    const zoom = Number.isFinite(z) ? z : 12;
    webRef.current?.injectJavaScript?.(
      `window.__flyTo && window.__flyTo(${lat}, ${lng}, ${zoom}); true;`,
    );
  }, [focusTarget]);

  useEffect(() => {
    if (!userLocation || !isFiniteLatLng(userLocation.lat, userLocation.lng)) {
      webRef.current?.injectJavaScript?.(
        `window.__setUserLocation && window.__setUserLocation(null, null); true;`,
      );
      return;
    }
    const [lat, lng] = toLatLng(userLocation.lat, userLocation.lng);
    webRef.current?.injectJavaScript?.(
      `window.__setUserLocation && window.__setUserLocation(${lat}, ${lng}); true;`,
    );
  }, [userLocation]);

  return (
    <View style={[styles.root, style]}>
      <MapWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={StyleSheet.absoluteFill}
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              id?: string;
              lat?: number;
              lng?: number;
              zoom?: number;
              north?: number;
              south?: number;
              east?: number;
              west?: number;
            };
            if (data.type === 'marker' && data.id) {
              onMarkerPress?.(data.id);
            }
            if (
              data.type === 'view' &&
              typeof data.lat === 'number' &&
              typeof data.lng === 'number' &&
              typeof data.zoom === 'number' &&
              typeof data.north === 'number' &&
              typeof data.south === 'number' &&
              typeof data.east === 'number' &&
              typeof data.west === 'number'
            ) {
              onViewChange?.({
                center: [data.lat, data.lng],
                zoom: data.zoom,
                bounds: {
                  north: data.north,
                  south: data.south,
                  east: data.east,
                  west: data.west,
                },
              });
            }
          } catch {
            // ignore
          }
        }}
      />
    </View>
  );
}
