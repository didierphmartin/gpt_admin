import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { DecisionProtocol } from '../types';

/** The decision protocols the backend registers; [] until loaded or when the call fails. */
export function useDecisionProtocols() {
  const [protocols, setProtocols] = useState<DecisionProtocol[]>([]);
  useEffect(() => {
    api.getDecisionProtocols().then((r) => setProtocols(r.protocols || [])).catch(() => setProtocols([]));
  }, []);
  const byId: Record<string, DecisionProtocol> = {};
  for (const p of protocols) byId[p.id] = p;
  return { protocols, byId };
}
