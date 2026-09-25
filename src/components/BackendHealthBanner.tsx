/**
 * Banner shown when the selected backend isn't running.
 *
 * Mounted above the app so it also covers the login screen — which is where a stale
 * backend selection actually bites: the sign-in call is usually the first request made,
 * and without this it fails silently and looks like bad credentials.
 */
import { useEffect, useState } from 'react';
import { getBackend, getBackendId, setBackendId } from '../lib/backendConfig';
import { START_HINTS, isBackendReachable, watchFetchFailures } from '../lib/backendHealth';

export function BackendHealthBanner() {
  const [unreachable, setUnreachable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const id = getBackendId();
  const { apiV1 } = getBackend();
  const hint = START_HINTS[id];

  useEffect(() => {
    watchFetchFailures(apiV1, () => setUnreachable(true));

    // PHP is served by the same Apache that served this page, so if you are reading
    // this it is up — no probe, and the default path spends no request.
    if (id === 'php') return;

    let live = true;
    void isBackendReachable(apiV1).then((ok) => {
      if (live && !ok) setUnreachable(true);
    });
    return () => {
      live = false;
    };
  }, [apiV1, id]);

  if (!unreachable || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] bg-red-900 text-red-100 px-4 py-3 shadow-lg"
    >
      <div className="font-semibold">{hint.name} backend is not running</div>
      <div className="opacity-90">
        <code className="font-mono">{apiV1}</code> refused the connection.{' '}
        {hint.cmd
          ? 'Start it from the gpt project root:'
          : 'Check that Apache and MySQL are started in the XAMPP control panel.'}
      </div>

      {hint.cmd && (
        <code className="mt-2 inline-block select-all rounded bg-black/35 px-2.5 py-1.5 font-mono">
          {hint.cmd}
        </code>
      )}

      <div className="mt-2.5 flex gap-2">
        {/* The one-click way out of a stale selection — the actual fix, not just a warning. */}
        {id !== 'php' && (
          <button
            type="button"
            onClick={() => {
              setBackendId('php');
              window.location.reload();
            }}
            className="rounded bg-red-100 px-3 py-1.5 font-semibold text-red-900 hover:bg-white"
          >
            Switch to the PHP backend
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded border border-red-100/50 px-3 py-1.5 hover:bg-red-100/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
