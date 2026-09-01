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

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1`;
  }
  return 'https://spendwise.app/api/v1';
}
