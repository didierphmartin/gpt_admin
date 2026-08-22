/**
 * SSO bounce to the login microservice (same flow as video-edit).
 * Local dev talks to the local login project; deployed hosts use the central
 * login service on synergyai.site. All share one login DB.
 */

const LOGIN_URLS: Record<string, string> = {
  localhost: 'http://localhost/login/',
};
const LOGIN_URL = LOGIN_URLS[location.hostname] ?? 'https://synergyai.site/login/';

// One registration per exact origin (the login service pins scheme+host+port).
// Minted with login/backend/scripts/mint-app-key.php — see Task 2 output.
const APP_KEYS: Record<string, string> = {
  localhost: 'lak_2fa40354a90609e5b481367fae3661e1',
  'synergyai.site': 'lak_f39de08a5f972de36c3ebc9e7ef5dde7',
};
const APP_KEY = APP_KEYS[location.hostname] ?? APP_KEYS['synergyai.site'];

/** Full-page bounce to the login service; it returns with #token=… */
export function startSsoLogin(): void {
  const back = location.origin + location.pathname;
  location.replace(`${LOGIN_URL}?app_key=${encodeURIComponent(APP_KEY)}&redirect=${encodeURIComponent(back)}`);
}

/** Pull the login-service token out of the URL fragment (login handoff). */
export function captureSsoToken(): string | null {
  if (!location.hash || location.hash.indexOf('token=') === -1) return null;
  const t = new URLSearchParams(location.hash.slice(1)).get('token');
  if (t) history.replaceState(null, '', location.pathname + location.search);
  return t;
}
