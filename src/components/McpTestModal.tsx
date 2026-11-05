import { useEffect, useRef, useState } from 'react';
import { testMcpServer, type McpServer, type McpTestRelay } from '../api/client';

interface RegistryResult {
  state: 'registered' | 'deprecated' | 'not-registered' | 'unreachable';
  name?: string;
  version?: string;
  link?: string;
}

interface Report {
  server?: { name?: string } | null;
}

interface McpProtocolTestApi {
  mount(
    el: HTMLElement,
    opts: {
      send: (
        message: unknown,
        ctx: { sessionId: string | null; protocolVersion: string | null; sibling: boolean }
      ) => Promise<McpTestRelay | { error: string }>;
      transport: string;
      url: string;
      onReport?: (report: Report) => void;
    }
  ): { run: () => Promise<unknown>; log: (entry: unknown) => void; destroy: () => void };
  registryStatus(name: string, url: string, fetchFn: (u: string) => Promise<unknown>): Promise<RegistryResult>;
  DEFAULT_LABELS: Record<string, string>;
}

declare global {
  interface Window {
    McpProtocolTest: McpProtocolTestApi;
    MCPProtocolValidator: unknown;
  }
}

const fmt = (t: string, o: Record<string, string | undefined>) =>
  t.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);

export function McpTestModal({ server, onClose }: { server: McpServer; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [registry, setRegistry] = useState<RegistryResult | null>(null);
  const labels = window.McpProtocolTest.DEFAULT_LABELS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const api = window.McpProtocolTest;
    const view = api.mount(host, {
      transport: 'http',
      url: server.url,
      send: async (message, ctx) => {
        try {
          const res = await testMcpServer({
            server_id: server.id,
            message,
            protocol_version: ctx.protocolVersion,
            session_id: ctx.sessionId,
            sibling: ctx.sibling,
          });
          if (res.success && res.relay) return res.relay;
          return { error: res.error || 'Test request failed' };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
      onReport: (report) => {
        const name = report.server?.name;
        if (!name) return;
        api
          .registryStatus(name, server.url, async (u) => {
            const r = await fetch(u);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then(setRegistry)
          .catch(() => setRegistry({ state: 'unreachable' }));
      },
    });
    return () => view.destroy();
  }, [server]);

  let registryLine: React.ReactNode = labels.registryNotTested;
  let registryClass = 'text-gray-500';
  if (registry) {
    const vars = { name: registry.name, version: registry.version };
    switch (registry.state) {
      case 'registered':
        registryLine = (
          <>
            ✅ {fmt(labels.registryRegistered, vars)}{' '}
            {registry.link && (
              <a href={registry.link} target="_blank" rel="noreferrer" className="underline">
                link
              </a>
            )}
          </>
        );
        registryClass = 'text-green-700';
        break;
      case 'deprecated':
        registryLine = <>⚠️ {fmt(labels.registryDeprecated, vars)}</>;
        registryClass = 'text-amber-700';
        break;
      case 'not-registered':
        registryLine = labels.registryNotRegistered;
        break;
      default:
        registryLine = labels.registryUnreachable;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Test: {server.name}</h3>
            <p className={`text-xs mt-1 ${registryClass}`}>{registryLine}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded"
          >
            ✕
          </button>
        </div>
        <div ref={hostRef} />
      </div>
    </div>
  );
}
