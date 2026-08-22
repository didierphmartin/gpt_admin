import { useEffect, useState } from 'react';
import { getApiV1Base } from './backendConfig';

/**
 * Shared model catalog client.
 *
 * Fetches the canonical catalog from `/gpt/backend/api/v1/models/catalog`
 * (served from `backend/resources/model_catalog.json`) and caches the result
 * at module scope so multiple components share one network call per page load.
 *
 * The catalog is the single source of truth for which LLM models the UI can
 * offer. Backend admin edits (Global Settings → LLM providers) update the
 * system_llm_settings table, which in turn is the reference for the "active"
 * model's prices per provider — those prices are reflected back into this
 * file (backend/resources/model_catalog.json) when admin ships price changes.
 */

export interface ModelChoice {
  id: string;
  label: string;
  desc: string;
  input: number;
  output: number;
}

export type Catalog = Record<string, ModelChoice[]>;

let cached: Catalog | null = null;
let pending: Promise<Catalog> | null = null;

async function fetchCatalog(): Promise<Catalog> {
  if (cached) return cached;
  if (pending) return pending;

  pending = fetch(getApiV1Base() + '/models/catalog')
    .then(async (r) => {
      const body = await r.json();
      if (!body.success || !body.providers) {
        throw new Error(body.error || 'Failed to load model catalog');
      }
      cached = body.providers as Catalog;
      return cached;
    })
    .catch((err) => {
      // Reset pending so the next call can retry instead of latching the error.
      pending = null;
      throw err;
    });

  return pending;
}

/**
 * React hook returning the catalog keyed by provider name.
 *
 * Returns an empty object while loading so callers can render safely without
 * a guard — `catalog[key] ?? []` gives an empty list until fetch completes.
 */
export function useModelCatalog(): {
  catalog: Catalog;
  loading: boolean;
  error: string | null;
} {
  const [catalog, setCatalog] = useState<Catalog>(cached ?? {});
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    let active = true;
    fetchCatalog()
      .then((c) => {
        if (active) {
          setCatalog(c);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { catalog, loading, error };
}
