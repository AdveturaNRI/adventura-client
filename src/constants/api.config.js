const DEFAULT_API_URL = 'http://localhost:3000/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? DEFAULT_API_URL;
/** Socket.IO / static origin (without `/api`). */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000';
