/**
 * Backend selector for the admin dashboard.
 *
 * gpt has two interchangeable backends serving the same API contract:
 *   - PHP  — the original, served same-origin at /gpt/backend/api/v1
 *   - TypeScript — the port, at http://localhost:3001/api/v1
 *
 * The choice is persisted in localStorage and read once at module load by every API module
 * (client.ts, AuthContext, portalApi, etc.). Switching writes the new choice and reloads the page so
 * all modules pick up the new base. Auth is shared (same JWT / JWT_SECRET), so the token carries over.
 *
 * Switching ALSO points the gpt user-facing frontend at the same backend: the admin (Apache
 * /gpt_admin/) and the frontend (/gpt/frontend/) share the localhost origin, so writing the frontend's
 * own override key (`API_BASE_URL`, read by gpt/frontend/assets/js/api-config.js) keeps both apps on the
 * same backend. The two apps use identical /api/v1 URLs, so the values map one-to-one.
 *
 * The Ledger service (src/api/ledger.ts) is a separate app and is intentionally NOT switched here.
 */

export type BackendId = 'php' | 'ts' | 'py';

export interface BackendDef {
  id: BackendId;
  label: string;
  /** The /api/v1 root. The admin base is this + '/admin'. */
  apiV1: string;
}

export const BACKENDS: Record<BackendId, BackendDef> = {
  php: { id: 'php', label: 'PHP', apiV1: '/gpt/backend/api/v1' },
  ts: { id: 'ts', label: 'TypeScript', apiV1: 'http://localhost:3001/api/v1' },
  py: { id: 'py', label: 'Python', apiV1: 'http://localhost:3002/api/v1' },
};

const STORAGE_KEY = 'admin_backend';

/**
 * The override key the gpt frontend (api-config.js) reads to pick its backend base.
 * Same-origin localStorage, so setting it here repoints the frontend too.
 */
const FRONTEND_STORAGE_KEY = 'API_BASE_URL';

/** The currently selected backend id (defaults to PHP). */
export function getBackendId(): BackendId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ts' || v === 'py' ? v : 'php';
  } catch {
    return 'php';
  }
}

export function getBackend(): BackendDef {
  return BACKENDS[getBackendId()];
}

/**
 * Persist the selection for the admin dashboard AND repoint the gpt frontend at the same backend
 * (via its own `API_BASE_URL` override key — same origin, so localStorage is shared).
 * Callers reload the page afterwards so modules re-read the base.
 */
export function setBackendId(id: BackendId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.setItem(FRONTEND_STORAGE_KEY, BACKENDS[id].apiV1);
  } catch {
    /* ignore storage failures */
  }
}

/** The /api/v1 root for the selected backend. */
export function getApiV1Base(): string {
  return getBackend().apiV1;
}

/** The /api/v1/admin base for the selected backend. */
export function getAdminBase(): string {
  return getBackend().apiV1 + '/admin';
}
