import { useState, useEffect } from 'react';
import { useUsers } from './hooks/useUsers';
import { UserTable } from './components/UserTable';
import { UserForm } from './components/UserForm';
import { ProviderSettings } from './components/ProviderSettings';
import { ApiKeysSettings } from './components/ApiKeysSettings';
import { AccountInfo } from './components/AccountInfo';
import { UsageStats } from './components/UsageStats';
import { CostsPanel } from './components/CostsPanel';
import { LLMSettingsPanel } from './components/LLMSettingsPanel';
import { McpServersPanel } from './components/McpServersPanel';
import { UserMcpServersPanel } from './components/UserMcpServersPanel';
import { UserAppKeysPanel } from './components/UserAppKeysPanel';
import { UserCostsPanel } from './components/UserCostsPanel';
import { LoginPage } from './components/LoginPage';
import { PackagesPanel } from './components/PackagesPanel';
import { LedgerAdmin } from './components/LedgerAdmin';
import { ReadmeViewer } from './components/ReadmeViewer';
import { AppPicker } from './components/AppPicker';
import { PortfolioAdmin } from './components/PortfolioAdmin';
import { VideoEditorAdmin } from './components/VideoEditorAdmin';
import { LoginAdmin } from './components/LoginAdmin';
import { AffiliatesPanel } from './components/AffiliatesPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { User } from './types';

type Tab = 'llm' | 'providers' | 'account' | 'mcp' | 'costs' | 'app-keys';
type MainView = 'users' | 'usage' | 'costs' | 'settings' | 'mcp' | 'packages' | 'readme' | 'affiliates';

function AdminPanel() {
  const { users, loading, error, fetchUsers, createUser, updateUser, deleteUser } = useUsers();
  const { logout, exitApp } = useAuth();
  const [mainView, setMainView] = useState<MainView>('users');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('llm');

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Delete user "${user.email}"? This will also delete all their settings.`)) {
      await deleteUser(user.id);
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
    }
  };

  const handleUserFormSubmit = async (email: string, password: string | undefined, firstName?: string, lastName?: string, role?: string) => {
    if (editingUser) {
      return await updateUser(editingUser.id, email, firstName, lastName, role, password);
    } else {
      return await createUser(email, password || '', firstName, lastName, role);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'llm', label: 'LLM API Keys' },
    { id: 'providers', label: 'Voice & Avatar Providers' },
    { id: 'mcp', label: 'MCP Servers' },
    { id: 'app-keys', label: 'App Keys' },
    { id: 'costs', label: 'Costs' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SynergyAI</h1>
              <p className="text-sm text-gray-500">Manage users and provider settings</p>
            </div>
            {/* Main Navigation */}
            <nav className="flex gap-1">
              <button
                onClick={() => setMainView('users')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'users'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setMainView('usage')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'usage'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Usage Stats
              </button>
              <button
                onClick={() => setMainView('costs')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'costs'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Costs
              </button>
              <button
                onClick={() => setMainView('settings')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'settings'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Global Settings
              </button>
              <button
                onClick={() => setMainView('mcp')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'mcp'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                MCP Servers
              </button>
              <button
                onClick={() => setMainView('packages')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'packages'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Packages
              </button>
              <button
                onClick={() => setMainView('readme')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'readme'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Readme
              </button>
              <button
                onClick={() => setMainView('affiliates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'affiliates'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Affiliates
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={exitApp}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Switch app
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
        )}

        {/* Usage Stats View */}
        {mainView === 'usage' && (
          <div className="bg-white rounded-lg shadow p-6">
            <UsageStats />
          </div>
        )}

        {/* Costs View */}
        {mainView === 'costs' && (
          <div className="bg-white rounded-lg shadow p-6">
            <CostsPanel />
          </div>
        )}

        {/* Settings View */}
        {mainView === 'settings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <LLMSettingsPanel />
          </div>
        )}

        {/* MCP Servers View */}
        {mainView === 'mcp' && (
          <div className="bg-white rounded-lg shadow p-6">
            <McpServersPanel />
          </div>
        )}

        {/* Packages View */}
        {mainView === 'packages' && (
          <div className="bg-white rounded-lg shadow p-6">
            <PackagesPanel />
          </div>
        )}

        {/* Readme View */}
        {mainView === 'readme' && (
          <div className="bg-white rounded-lg shadow p-6">
            <ReadmeViewer url="/gpt/backend/README.md" title="AI backend documentation" />
          </div>
        )}

        {/* Affiliates View */}
        {mainView === 'affiliates' && <AffiliatesPanel />}

        {/* Users View */}
        {mainView === 'users' && (
          <>
            {/* User Table */}
            {loading && users.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Loading users...
              </div>
            ) : (
              <UserTable
                users={users}
                selectedUserId={selectedUser?.id || null}
                onSelectUser={setSelectedUser}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                onCreateUser={handleCreateUser}
              />
            )}
          </>
        )}

        {/* User Settings Panel */}
        {mainView === 'users' && selectedUser && (
          <div className="bg-white rounded-lg shadow">
            {/* User Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Settings for: {selectedUser.email}
                </h2>
                <p className="text-sm text-gray-500">
                  {[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || 'No name set'}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'llm' && <ApiKeysSettings userId={selectedUser.id} />}
              {activeTab === 'providers' && (
                <ProviderSettings userId={selectedUser.id} key={`providers-${selectedUser.id}`} />
              )}
              {activeTab === 'mcp' && (
                <UserMcpServersPanel userId={selectedUser.id} key={`mcp-${selectedUser.id}`} />
              )}
              {activeTab === 'app-keys' && (
                <UserAppKeysPanel userId={selectedUser.id} key={`app-keys-${selectedUser.id}`} />
              )}
              {activeTab === 'costs' && (
                <UserCostsPanel userId={selectedUser.id} key={`costs-${selectedUser.id}`} />
              )}
              {activeTab === 'account' && (
                <AccountInfo userId={selectedUser.id} key={`account-${selectedUser.id}`} />
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* User Form Modal */}
      {showUserForm && (
        <UserForm
          user={editingUser}
          onSubmit={handleUserFormSubmit}
          onCancel={() => setShowUserForm(false)}
        />
      )}
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, isAdmin, app } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return <LoginPage />;
  }

  // Pick which app to administer
  if (!app) {
    return <AppPicker />;
  }

  if (app === 'portfolio') {
    return <PortfolioAdmin />;
  }

  if (app === 'ledger') {
    return <LedgerAdmin />;
  }

  if (app === 'video_editor') {
    return <VideoEditorAdmin />;
  }

  if (app === 'login') {
    return <LoginAdmin />;
  }

  // 'synergy' and 'ai_backend' both currently land on AdminPanel — that
  // panel admins gpt/backend (LLM keys, providers, MCP, packages, costs).
  // SynergyAI as a user-facing app surface (e.g. embedded chat) is a
  // separate follow-up; for now both cards reach the same admin.
  return <AdminPanel />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
