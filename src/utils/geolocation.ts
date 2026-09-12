export type DeviceLocation = {
  lat: number;
  lng: number;
};

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
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Геолокация недоступна в этом браузере'));
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
        if (error.code === error.PERMISSION_DENIED) {
          reject(new GeolocationPermissionError());
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error('Не удалось определить местоположение вовремя'));
          return;
        }
        reject(new Error('Не удалось определить местоположение'));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 12000,
        maximumAge: options?.maximumAge ?? 30_000,
      },
    );
  });
}
