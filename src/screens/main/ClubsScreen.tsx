import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClubsMap } from '@/components/map/ClubsMap';
import { ClubsMapFeed } from '@/components/map/ClubsMapFeed';
import type { ClubsMapBounds, ClubsMapFocusTarget } from '@/components/map/clubs-map.types';
import {
  approxRadiusKmForZoom,
  haversineKm,
  isPointInBounds,
} from '@/components/map/clubs-map.types';
import {
  DEFAULT_CLUBS_CITY,
  getClubsMapInitialCamera,
  getClubsMapSession,
  markClubsMapInitialCameraDone,
  markClubsMapInitialLocateDone,
  sanitizeClubsMapSession,
  setClubsMapCamera,
  setClubsMapLocationDenied,
  setClubsMapSelectedCity,
  setClubsMapUserLocation,
  type ClubsSelectedCity,
} from '@/components/map/clubs-map-session';
import {
  MapSearchControls,
  type MapSearchControlsHandle,
} from '@/components/map/MapSearchControls';
import { isFiniteLatLng, toLatLng } from '@/components/map/map-coords';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { toast } from '@/components/ui';
import { MAP_DEFAULT_CENTER } from '@/constants/map.config';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { listClubsMap, reverseGeocode, type ClubListItem } from '@/services/clubs/clubsApi';
import {
  GEOLOCATION_MANUAL_FALLBACK_MESSAGE,
  GeolocationPermissionError,
  readDeviceLocation,
} from '@/utils/geolocation';

function createStyles(
  colors: ThemeColors,
  isDesktop: boolean,
  mapCollapsed: boolean,
  topPadding: number,
) {
  const hideMap = mapCollapsed;
  const hideFeed = !isDesktop && !mapCollapsed;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: isDesktop ? Spacing.lg : Spacing.xs,
      paddingTop: topPadding,
      gap: Spacing.md,
    },
    root: {
      flex: 1,
      minHeight: 0,
      flexDirection: isDesktop ? 'row' : 'column',
      gap: hideMap || hideFeed ? 0 : Spacing.sm,
    },
    mapPane: {
      flex: hideMap ? 0 : 1,
      minHeight: 0,
      minWidth: 0,
      maxHeight: hideMap ? 0 : undefined,
      maxWidth: hideMap ? 0 : undefined,
      opacity: hideMap ? 0 : 1,
      overflow: 'hidden',
    },
    mapFrame: {
      flex: 1,
      minHeight: 0,
      borderRadius: isDesktop ? 20 : 12,
      overflow: 'hidden',
      borderWidth: isDesktop ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    feedPane: {
      flex: hideFeed ? 0 : 1,
      minHeight: 0,
      minWidth: 0,
      maxHeight: hideFeed ? 0 : undefined,
      maxWidth: hideFeed ? 0 : undefined,
      opacity: hideFeed ? 0 : 1,
      overflow: 'hidden',
    },
    headerToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    headerToggleLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
  });
}

export default function ClubsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hideMobileChrome = useIsDesktopSidebarVisible();
  const topPadding = isDesktopWeb ? Spacing.lg : insets.top + Spacing.md;
  sanitizeClubsMapSession();
  const session = getClubsMapSession();
  const initialCamera = getClubsMapInitialCamera();

  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [selectedCity, setSelectedCity] = useState<ClubsSelectedCity | null>(() => {
    const city = session.selectedCity ?? DEFAULT_CLUBS_CITY;
    if (city && isFiniteLatLng(city.lat, city.lng)) {
      return city;
    }
    return DEFAULT_CLUBS_CITY;
  });
  const cityChosenManuallyRef = useRef(session.cityChosenManually);
  const [focusTarget, setFocusTarget] = useState<ClubsMapFocusTarget | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    const point = session.userLocation;
    return point && isFiniteLatLng(point.lat, point.lng) ? point : null;
  });
  const [locationDenied, setLocationDenied] = useState(session.locationDenied);
  const [mapCenter, setMapCenter] = useState<[number, number]>(() =>
    toLatLng(initialCamera.center[0], initialCamera.center[1]),
  );
  const [mapZoom, setMapZoom] = useState(() =>
    Number.isFinite(initialCamera.zoom) ? initialCamera.zoom : 12,
  );
  const [mapBounds, setMapBounds] = useState<ClubsMapBounds | null>(null);
  const [lockCamera, setLockCamera] = useState(session.didInitialCamera);
  const focusTokenRef = useRef(0);
  const deniedToastShownRef = useRef(session.locationDenied);
  const mapSearchRef = useRef<MapSearchControlsHandle>(null);
  const applyUserLocationRef = useRef<
    (point: { lat: number; lng: number }, moveCamera?: boolean) => void
  >(() => undefined);

  const notifyGeolocationFallback = useCallback(
    (denied = false, options?: { once?: boolean }) => {
      if (denied) {
        setLocationDenied(true);
        setClubsMapLocationDenied(true);
      }

      if (options?.once && deniedToastShownRef.current) {
        mapSearchRef.current?.focusSearch();
        return;
      }

      deniedToastShownRef.current = true;
      toast.info(GEOLOCATION_MANUAL_FALLBACK_MESSAGE, {
        title: 'Местоположение',
        duration: 4500,
      });
      mapSearchRef.current?.focusSearch();
    },
    [],
  );

  const styles = useThemedStyles((theme) =>
    createStyles(theme, isDesktopWeb, mapCollapsed, topPadding),
  );

  const flyTo = useCallback((lat: number, lng: number, zoom = 12) => {
    if (!isFiniteLatLng(lat, lng)) {
      return;
    }
    const [safeLat, safeLng] = toLatLng(lat, lng);
    const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : 12;
    focusTokenRef.current += 1;
    setFocusTarget({
      token: focusTokenRef.current,
      lat: safeLat,
      lng: safeLng,
      zoom: safeZoom,
    });
    setMapCenter([safeLat, safeLng]);
    setMapZoom(safeZoom);
    setClubsMapCamera([safeLat, safeLng], safeZoom);
    markClubsMapInitialCameraDone();
    setLockCamera(true);
  }, []);

  const selectCity = useCallback(
    (
      city: ClubsSelectedCity | null,
      options?: { moveCamera?: boolean; manual?: boolean },
    ) => {
      const manual = options?.manual ?? true;
      const moveCamera = options?.moveCamera ?? Boolean(city);
      cityChosenManuallyRef.current = manual;

      if (!city) {
        setSelectedCity(null);
        setClubsMapSelectedCity(null, { manual });
        return;
      }

      const [lat, lng] = toLatLng(city.lat, city.lng);
      const safeCity: ClubsSelectedCity = { label: city.label, lat, lng };
      setSelectedCity(safeCity);
      setClubsMapSelectedCity(safeCity, { manual });
      if (moveCamera && isFiniteLatLng(city.lat, city.lng)) {
        flyTo(lat, lng, 12);
      }
    },
    [flyTo],
  );

  const applyUserLocation = useCallback(
    (point: { lat: number; lng: number }, moveCamera = true) => {
      if (!isFiniteLatLng(point.lat, point.lng)) {
        return;
      }
      const [lat, lng] = toLatLng(point.lat, point.lng);
      setLocationDenied(false);
      setClubsMapLocationDenied(false);
      deniedToastShownRef.current = false;
      setUserLocation({ lat, lng });
      setClubsMapUserLocation({ lat, lng });
      if (moveCamera) {
        flyTo(lat, lng, 14);
      }

      if (!cityChosenManuallyRef.current) {
        void reverseGeocode(lat, lng)
          .then((hit) => {
            if (cityChosenManuallyRef.current) {
              return;
            }
            if (!isFiniteLatLng(hit.lat, hit.lng)) {
              selectCity(
                {
                  label: hit.shortName?.trim() || hit.displayName,
                  lat: MAP_DEFAULT_CENTER[0],
                  lng: MAP_DEFAULT_CENTER[1],
                },
                { moveCamera: false, manual: false },
              );
              return;
            }
            selectCity(
              {
                label: hit.shortName?.trim() || hit.displayName,
                lat: Number(hit.lat),
                lng: Number(hit.lng),
              },
              { moveCamera: false, manual: false },
            );
          })
          .catch(() => {
            // оставляем Москву / текущий авто-город
          });
      }
    },
    [flyTo, selectCity],
  );
  applyUserLocationRef.current = applyUserLocation;

  useEffect(() => {
    if (!session.selectedCity) {
      setClubsMapSelectedCity(DEFAULT_CLUBS_CITY, { manual: false });
    }
  }, [session.selectedCity]);

  useEffect(() => {
    const point = session.userLocation;
    if (!point || cityChosenManuallyRef.current) {
      return;
    }

    let cancelled = false;
    void reverseGeocode(point.lat, point.lng)
      .then((hit) => {
        if (cancelled || cityChosenManuallyRef.current) {
          return;
        }
        selectCity(
          {
            label: hit.shortName?.trim() || hit.displayName,
            lat: Number(hit.lat),
            lng: Number(hit.lng),
          },
          { moveCamera: false, manual: false },
        );
      })
      .catch(() => {
        // оставляем Москву
      });

    return () => {
      cancelled = true;
    };
  }, [selectCity, session.userLocation]);

  useEffect(() => {
    if (userLocation) {
      setLocationDenied(false);
      setClubsMapLocationDenied(false);
    }
  }, [userLocation]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return;
    }

    let cancelled = false;

    const onGranted = (moveCamera: boolean) => {
      setLocationDenied(false);
      setClubsMapLocationDenied(false);
      void readDeviceLocation({ maximumAge: 0 })
        .then((point) => {
          if (!cancelled) {
            applyUserLocationRef.current(point, moveCamera);
            markClubsMapInitialLocateDone();
          }
        })
        .catch(() => {
          // ignore
        });
    };

    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.state === 'granted' && !getClubsMapSession().didInitialLocate) {
          onGranted(true);
        }
        result.addEventListener('change', () => {
          if (result.state === 'granted') {
            onGranted(!getClubsMapSession().didInitialCamera);
          } else if (result.state === 'denied') {
            setLocationDenied(true);
            setClubsMapLocationDenied(true);
          }
        });
      })
      .catch(() => {
        // Permissions API может быть недоступен
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void listClubsMap()
        .then(setClubs)
        .catch(() => setClubs([]));

      if (getClubsMapSession().didInitialLocate) {
        return () => {
          cancelled = true;
        };
      }

      void readDeviceLocation({ maximumAge: 60_000 })
        .then((point) => {
          if (cancelled) {
            return;
          }
          applyUserLocation(point, !getClubsMapSession().didInitialCamera);
          markClubsMapInitialLocateDone();
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          markClubsMapInitialLocateDone();
          notifyGeolocationFallback(error instanceof GeolocationPermissionError, {
            once: true,
          });
        });

      return () => {
        cancelled = true;
      };
    }, [applyUserLocation, notifyGeolocationFallback]),
  );

  const markers = useMemo(
    () =>
      clubs
        .filter((club) => isFiniteLatLng(club.lat, club.lng))
        .map((club) => {
          const [lat, lng] = toLatLng(club.lat, club.lng);
          return {
            id: club.id,
            lat,
            lng,
            title: club.name,
            coverUrl: club.coverUrl,
            iconUrl: club.mapIconUrl ?? null,
            accentColor: club.mapAccentColor ?? null,
          };
        }),
    [clubs],
  );

  const clubsWithDistance = useMemo(() => {
    const center = { lat: mapCenter[0], lng: mapCenter[1] };
    return clubs
      .map((club) => ({
        ...club,
        distanceKm: haversineKm(center, club),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [clubs, mapCenter]);

  const nearbyClubs = useMemo(() => {
    const center = { lat: mapCenter[0], lng: mapCenter[1] };
    const radiusKm = approxRadiusKmForZoom(mapZoom);

    return clubsWithDistance.filter((club) => {
      if (mapBounds) {
        return isPointInBounds(club, mapBounds);
      }
      return haversineKm(center, club) <= radiusKm;
    });
  }, [clubsWithDistance, mapBounds, mapCenter, mapZoom]);

  const toggleMapCollapsed = useCallback(() => {
    setMapCollapsed((prev) => !prev);
  }, []);



  const mobileViewToggle =
    !hideMobileChrome && !isDesktopWeb ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mapCollapsed ? 'Показать карту' : 'Показать ленту клубов'}
        onPress={toggleMapCollapsed}
        style={({ pressed }) => [styles.headerToggle, pressed && { opacity: 0.88 }]}>
        <Ionicons
          name={mapCollapsed ? 'map-outline' : 'list-outline'}
          size={16}
          color={colors.text}
        />
        <Text style={styles.headerToggleLabel}>{mapCollapsed ? 'Карта' : 'Лента'}</Text>
      </Pressable>
    ) : null;

  return (
    <ScreenTransition animateOnFocus>
      <View style={styles.screen}>
        {hideMobileChrome ? null : (
          <MobileScreenHeader title="Клубы" leftAction={mobileViewToggle} />
        )}
        <View style={styles.root}>
          <View
            style={styles.mapPane}
            pointerEvents={mapCollapsed ? 'none' : 'auto'}
            accessibilityElementsHidden={mapCollapsed}
            importantForAccessibility={mapCollapsed ? 'no-hide-descendants' : 'auto'}>
            <View style={styles.mapFrame}>
              <ClubsMap
                center={mapCenter}
                zoom={mapZoom}
                lockCamera={lockCamera}
                markers={markers}
                focusTarget={focusTarget}
                userLocation={userLocation}
                onViewChange={(view) => {
                  if (!isFiniteLatLng(view.center[0], view.center[1])) {
                    return;
                  }
                  const center = toLatLng(view.center[0], view.center[1]);
                  setMapCenter(center);
                  setMapZoom(Number.isFinite(view.zoom) ? view.zoom : 12);
                  setMapBounds(view.bounds);
                  setClubsMapCamera(center, Number.isFinite(view.zoom) ? view.zoom : 12);
                  setLockCamera(true);
                }}
                onMarkerPress={(id) => {
                  router.push(`/clubs/${id}`);
                }}
              />
              <MapSearchControls
                ref={mapSearchRef}
                locationDenied={locationDenied && !userLocation}
                onCollapseMap={isDesktopWeb ? toggleMapCollapsed : undefined}
                onSelectCity={(hit, options) => {
                  selectCity(
                    {
                      label: hit.shortName?.trim() || hit.displayName,
                      lat: hit.lat,
                      lng: hit.lng,
                    },
                    { manual: true, moveCamera: options?.moveCamera ?? true },
                  );
                }}
                onLocationDenied={() => {
                  setLocationDenied(true);
                  setClubsMapLocationDenied(true);
                }}
                onRetryLocation={() => {
                  void readDeviceLocation({ maximumAge: 0 })
                    .then((point) => {
                      deniedToastShownRef.current = false;
                      applyUserLocation(point, true);
                      markClubsMapInitialLocateDone();
                    })
                    .catch((error) => {
                      notifyGeolocationFallback(error instanceof GeolocationPermissionError);
                    });
                }}
                onLocateMe={(point) => {
                  deniedToastShownRef.current = false;
                  applyUserLocation(point, true);
                  markClubsMapInitialLocateDone();
                }}
              />
            </View>
          </View>

          <View
            style={styles.feedPane}
            pointerEvents={!isDesktopWeb && !mapCollapsed ? 'none' : 'auto'}
            accessibilityElementsHidden={!isDesktopWeb && !mapCollapsed}
            importantForAccessibility={
              !isDesktopWeb && !mapCollapsed ? 'no-hide-descendants' : 'auto'
            }>
            <ClubsMapFeed
              nearbyClubs={nearbyClubs}
              allClubs={clubsWithDistance}
              mapCollapsed={mapCollapsed}
              selectedCity={selectedCity}
              onSelectCity={selectCity}
              showMapToggle={isDesktopWeb}
              onToggleMap={toggleMapCollapsed}
              onPressClub={(club) => {
                router.push(`/clubs/${club.id}`);
              }}
            />
          </View>
        </View>
      </View>
    </ScreenTransition>
  );
}
