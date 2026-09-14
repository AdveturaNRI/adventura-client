export type DeviceLocation = {
  lat: number;
  lng: number;
};

export const GEOLOCATION_MANUAL_FALLBACK_MESSAGE =
  'Не удалось определить местоположение автоматически. Пожалуйста, выберите город из списка вручную';

export class GeolocationPermissionError extends Error {
  constructor(message = 'Вы запретили доступ к геолокации') {
    super(message);
    this.name = 'GeolocationPermissionError';
  }
}

export function readDeviceLocation(options?: {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error(GEOLOCATION_MANUAL_FALLBACK_MESSAGE));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (error) => {
          if (error?.code === error.PERMISSION_DENIED) {
            reject(new GeolocationPermissionError());
            return;
          }

          reject(new Error(GEOLOCATION_MANUAL_FALLBACK_MESSAGE));
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 12000,
          maximumAge: options?.maximumAge ?? 30_000,
        },
      );
    } catch {
      reject(new Error(GEOLOCATION_MANUAL_FALLBACK_MESSAGE));
    }
  });
}
