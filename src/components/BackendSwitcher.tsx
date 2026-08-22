import { getBackendId, setBackendId, BACKENDS, getBackend, type BackendId } from '../lib/backendConfig';

/**
 * Page-level tabs (one per backend) for the admin home page. Selecting a tab persists the choice and
 * reloads so every API module re-reads its base URL. The active tab reflects the current backend.
 */
export function BackendTabs() {
  const current = getBackendId();

  const onSelect = (id: BackendId) => {
    if (id === current) return;
    setBackendId(id);
    window.location.reload();
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Backend environment</h2>
          <p className="text-sm text-gray-500">Which backend the admin dashboard talks to</p>
        </div>
        <span className="text-xs text-gray-400">
          Active: <span className="font-medium text-gray-600">{getBackend().apiV1}</span>
        </span>
      </div>
      <div className="mt-3 border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {Object.values(BACKENDS).map((b) => {
            const active = b.id === current;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {b.label} backend
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
