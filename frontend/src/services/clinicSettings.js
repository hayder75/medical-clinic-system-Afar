import api from './api';

let cachedSettings = null;
let loadPromise = null;

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : `${window.location.protocol}//${window.location.hostname}`;

const DEFAULTS = {
  name: 'Tena Lesew HMS',
  tagline: 'Quality Healthcare You Can Trust',
  logoUrl: '/clinic-logo.jpg'
};

function resolveLogoUrl(url) {
  if (!url) return '/clinic-logo.jpg';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return API_BASE + url;
  return url;
}

export async function loadClinicSettings() {
  if (cachedSettings) return cachedSettings;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await api.get('/admin/clinic-settings');
      cachedSettings = { ...res.data, logoUrl: resolveLogoUrl(res.data.logoUrl) };
    } catch {
      cachedSettings = { ...DEFAULTS };
    }
    window.__CS__ = cachedSettings;
    return cachedSettings;
  })();
  return loadPromise;
}

export function getClinicSettings() {
  const s = cachedSettings || DEFAULTS;
  const resolved = { ...s, logoUrl: s === DEFAULTS ? s.logoUrl : resolveLogoUrl(s.logoUrl) };
  window.__CS__ = resolved;
  return resolved;
}

export async function reloadClinicSettings() {
  cachedSettings = null;
  loadPromise = null;
  return loadClinicSettings();
}
