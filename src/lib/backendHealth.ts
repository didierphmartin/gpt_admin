/**
 * Detects a backend that isn't running, so the dashboard can say so.
 *
 * The backend choice (see backendConfig.ts) persists in localStorage, but the TypeScript
 * and Python backends are started by hand — so a selection made during testing outlives
 * the server it names. Every request then fails with net::ERR_CONNECTION_REFUSED, which
 * surfaces as a login that does nothing rather than as "this backend is down".
 */
import type { BackendId } from './backendConfig';

export interface StartHint {
  /** How the backend is named to the user. */
  name: string;
  /** Command to start it, relative to the gpt project root; null when there is nothing to run. */
  cmd: string | null;
}

export const START_HINTS: Record<BackendId, StartHint> = {
  php: { name: 'PHP', cmd: null },
  ts: { name: 'TypeScript', cmd: 'cd backend_typescript && npm run dev' },
  py: { name: 'Python', cmd: 'cd backend_python && ./run.sh' },
};

/**
 * Whether anything is listening at `apiV1`.
 *
 * mode:'no-cors' is deliberate: a normal fetch also rejects when the server IS running
 * but CORS blocks the response, which would report a live backend as dead. An opaque
 * request resolves for anything that answers at all, so a rejection means only one
 * thing — nothing is listening.
 */
export async function isBackendReachable(apiV1: string): Promise<boolean> {
  try {
    await fetch(apiV1, { mode: 'no-cors', cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

let watching = false;

/**
 * Report API calls that fail at the network level, so a backend that dies mid-session
 * announces itself too. An HTTP error status is left alone: the server answered, and
 * that is a different problem.
 */
export function watchFetchFailures(apiV1: string, onUnreachable: () => void): void {
  if (watching) return;
  watching = true;

  const native = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return native(input, init).catch((err: unknown) => {
      if (url.startsWith(apiV1)) onUnreachable();
      throw err;
    });
  };
}
