// API Key management and API helper utilities for SpendWise

export const SPENDWISE_API_KEY_STORAGE = 'spendwise_user_api_key';

export function getStoredApiKey(): string {
  try {
    const saved = localStorage.getItem(SPENDWISE_API_KEY_STORAGE);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {
    // fallback
  }
  // Generate a persistent key if none exists
  const newKey = generateApiKey();
  saveStoredApiKey(newKey);
  return newKey;
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 32; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `spw_live_${randomPart}`;
}

export function saveStoredApiKey(key: string): void {
  try {
    localStorage.setItem(SPENDWISE_API_KEY_STORAGE, key.trim());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendwise_api_key_updated', { detail: key }));
    }
  } catch (e) {
    console.error('Failed to save API key to localStorage', e);
  }
}

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

export const BACKEND_UNAVAILABLE_MESSAGE =
  'SpendWise backend API (/api/v1/whatsapp/*) returned 404 on this host. This domain is serving a static frontend build without the Node.js server (server.ts). Deploy full-stack ("npm run build && npm start"), proxy /api/* to the Node server, or set VITE_API_BASE_URL to your running backend URL.';

export function getBackendOrigin(): string {
  const raw = typeof metaEnv.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL.trim() : '';
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getBackendOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export async function parseJsonSafely<T = Record<string, any>>(
  res: Response
): Promise<{ data: T | null; isJson: boolean; isBackendMissing: boolean }> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      data: null,
      isJson: false,
      isBackendMissing: res.status === 404,
    };
  }

  if (
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  ) {
    try {
      return {
        data: JSON.parse(trimmed) as T,
        isJson: true,
        isBackendMissing: false,
      };
    } catch {
      return {
        data: null,
        isJson: false,
        isBackendMissing: res.status === 404,
      };
    }
  }

  return {
    data: null,
    isJson: false,
    isBackendMissing: res.status === 404,
  };
}

export function getApiBaseUrl(): string {
  const backendOrigin = getBackendOrigin();
  if (backendOrigin) {
    return `${backendOrigin}/api/v1`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1`;
  }
  return 'https://spendwise.app/api/v1';
}
