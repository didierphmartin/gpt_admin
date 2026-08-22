import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PortfolioUserList } from './PortfolioUserList';
import { ReadmeViewer } from './ReadmeViewer';

type PortfolioView = 'users' | 'readme';

export function PortfolioAdmin() {
  const { user, portfolioToken, exitApp, logout } = useAuth();
  const [view, setView] = useState<PortfolioView>('users');

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <header className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PortfolioManagement Admin</h1>
              <p className="text-sm text-gray-500">Manage Portfolio users</p>
            </div>
            <nav className="flex gap-1">
              <NavButton label="Users" active={view === 'users'} onClick={() => setView('users')} />
              <NavButton label="Readme" active={view === 'readme'} onClick={() => setView('readme')} />
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={exitApp}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Switch app
            </button>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {view === 'users' && (
            !portfolioToken ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-700 mb-2">
                  Portfolio access is not active for this session.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Sign in with email + password to enable PortfolioManagement —
                  Google, Facebook, and passkey logins do not authenticate against
                  the Portfolio backend.
                </p>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                >
                  Sign out and re-authenticate
                </button>
              </div>
            ) : (
              <PortfolioUserList token={portfolioToken} />
            )
          )}

          {view === 'readme' && (
            <div className="bg-white rounded-lg shadow p-6">
              <ReadmeViewer
                url="/PortfolioManagement/backend/portfolio-service/README.md"
                title="PortfolioManagement service documentation"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}
