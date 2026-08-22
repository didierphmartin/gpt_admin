import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LedgerPanel } from './LedgerPanel';
import { LedgerTransactions } from './LedgerTransactions';
import { ReadmeViewer } from './ReadmeViewer';

type LedgerView = 'accounts' | 'transactions' | 'readme';

export function LedgerAdmin() {
    const { user, exitApp, logout } = useAuth();
    const [view, setView] = useState<LedgerView>('accounts');

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <header className="bg-white shadow flex-shrink-0">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Ledger Admin</h1>
                            <p className="text-sm text-gray-500">Browse accounts and transactions</p>
                        </div>
                        <nav className="flex gap-1">
                            <NavButton label="Accounts" active={view === 'accounts'} onClick={() => setView('accounts')} />
                            <NavButton label="Transactions" active={view === 'transactions'} onClick={() => setView('transactions')} />
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
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        {view === 'accounts' && <LedgerPanel />}
                        {view === 'transactions' && <LedgerTransactions />}
                        {view === 'readme' && (
                            <ReadmeViewer url="/LandingPage/Ledger/README.md" title="Ledger service documentation" />
                        )}
                    </div>
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
                active ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            {label}
        </button>
    );
}
