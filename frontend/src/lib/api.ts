// Resolves the backend base URL.
// - NEXT_PUBLIC_API_URL set: use it (e.g. a separately hosted backend).
// - `next dev` on port 3000: backend runs separately on port 8000.
// - Otherwise (production behind Caddy): backend is served from the same origin.
function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return '';
}

export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}

export function wsUrl(path: string): string {
  const base = getApiBase() || window.location.origin;
  return `${base.replace(/^http/, 'ws')}${path}`;
}
