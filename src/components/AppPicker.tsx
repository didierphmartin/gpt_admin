import { useAuth } from '../contexts/AuthContext';
import type { ManagedApp } from '../contexts/AuthContext';
import type { ReactNode } from 'react';
import { BackendTabs } from './BackendSwitcher';
import { getBackendId } from '../lib/backendConfig';

export function AppPicker() {
  const { selectApp, logout, user, portfolioToken } = useAuth();
  // PortfolioManagement and Ledger have no TypeScript backend — hide them when the TS tab is active.
  const isTs = getBackendId() === 'ts';

  return (
    <div className="h-full bg-gray-100 overflow-y-auto">
      <header className="bg-white shadow flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-500">Choose an application or service to manage</p>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <BackendTabs />

        <Section title="Applications" subtitle="End-user-facing apps">
          <Card
            title="SynergyAI"
            description="Manage users, LLM keys, providers, MCP servers, packages, and costs for the SynergyAI / GPT app."
            color="blue"
            onClick={() => selectApp('synergy')}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            }
          />
          {!isTs && (
            <Card
              title="Video Editor"
              description="Users, per-generation AI usage (video, image, music) and costs, plus the model price table."
              color="purple"
              onClick={() => selectApp('video_editor')}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              }
            />
          )}
          {!isTs && (
            <Card
              title="PortfolioManagement"
              description="Manage users for the PortfolioManagement app."
              color="emerald"
              onClick={() => selectApp('portfolio')}
              footer={
                !portfolioToken ? (
                  <p className="text-xs text-amber-700 mt-3">
                    Portfolio access not active for this session — sign out and sign in with email + password to enable it.
                  </p>
                ) : null
              }
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 14l4-4 4 4 5-5" />
              }
            />
          )}
        </Section>

        <Section title="Services" subtitle="Backend services consumed by the apps">
          <Card
            title="AI backend"
            description="Backend that serves LLM, MCP, and tools to the apps. Manage providers, keys, packages, and costs."
            color="slate"
            onClick={() => selectApp('ai_backend')}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12l3-3m-3 3l3 3M19 6v12"
              />
            }
          />
          {!isTs && (
            <Card
              title="Ledger"
              description="Browse ledger accounts and transactions across all applications."
              color="purple"
              onClick={() => selectApp('ledger')}
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-9 4h12a2 2 0 002-2V7a2 2 0 00-2-2h-3.28a1 1 0 01-.948-.684l-.544-1.632A1 1 0 0012.28 2h-.56a1 1 0 00-.948.684l-.544 1.632A1 1 0 019.28 5H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              }
            />
          )}
          <Card
            title="Login"
            description="Identity service: manage users, roles, SSO app keys, passkeys, and user API keys across all apps."
            color="indigo"
            onClick={() => selectApp('login')}
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            }
          />
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 pb-2 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{children}</div>
    </section>
  );
}

const COLOR_CLASSES: Record<string, { bg: string; ring: string }> = {
  blue: { bg: 'bg-blue-600', ring: 'hover:ring-blue-500' },
  emerald: { bg: 'bg-emerald-600', ring: 'hover:ring-emerald-500' },
  purple: { bg: 'bg-purple-600', ring: 'hover:ring-purple-500' },
  slate: { bg: 'bg-slate-700', ring: 'hover:ring-slate-500' },
  indigo: { bg: 'bg-indigo-600', ring: 'hover:ring-indigo-500' },
};

function Card({
  title,
  description,
  color,
  onClick,
  icon,
  footer,
}: {
  title: string;
  description: string;
  color: keyof typeof COLOR_CLASSES;
  onClick: () => void;
  icon: ReactNode;
  footer?: ReactNode;
}) {
  const { bg, ring } = COLOR_CLASSES[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-lg shadow p-8 hover:shadow-lg hover:ring-2 ${ring} transition cursor-pointer`}
    >
      <div className={`h-12 w-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-600">{description}</p>
      {footer}
    </button>
  );
}

// Avoid an unused-import lint warning if ManagedApp is later imported by name elsewhere.
export type { ManagedApp };
