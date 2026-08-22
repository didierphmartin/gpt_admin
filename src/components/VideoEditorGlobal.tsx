import { useEffect, useState } from 'react';
import { saveVideoEditorProvider, type VeProviderModel } from '../api/client';
import { Switch } from './Switch';

// Mirrors gpt's Global Settings: the platform-wide provider + model catalog for the
// video editor. Per-role selection lives in the Packages tab; per-user overrides in
// the Users tab. Everything here writes video_edit_providers via saveProvider.
export interface ProviderRow {
  provider: string; label: string; api_base: string; enabled: number;
  has_key: boolean; api_key?: string | null; models: VeProviderModel[]; updated_at: string;
}

const KINDS = ['video', 'image', 'music'];
const defaultUnit = (kind: string) => (kind === 'image' ? 'image' : kind === 'music' ? 'clip' : 'sec');
const kindPill = (k: string) =>
  k === 'video' ? 'bg-purple-100 text-purple-700' : k === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

interface Draft {
  label: string; api_base: string; enabled: boolean;
  api_key: string;               // the stored key, shown masked; editable in place
  origKey: string;               // loaded baseline — save only sends the key when it changed
  models: VeProviderModel[];
}

const toDraft = (p: ProviderRow): Draft => ({
  label: p.label ?? p.provider,
  api_base: p.api_base ?? '',
  enabled: !!p.enabled,
  api_key: p.api_key ?? '',
  origKey: p.api_key ?? '',
  models: p.models.map(m => ({ ...m })),
});

function EyeButton({ revealed, onClick }: { revealed: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-400 hover:text-gray-600">
      {revealed ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      )}
    </button>
  );
}

export function VideoEditorGlobal({ providers, onSaved }: { providers: ProviderRow[]; onSaved: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // New-provider mini form
  const [newProv, setNewProv] = useState({ provider: '', label: '' });
  const [addingProv, setAddingProv] = useState(false);
  const [newMsg, setNewMsg] = useState<string | null>(null);

  // Reseed the editable drafts whenever the catalog reloads (i.e. after a save).
  useEffect(() => {
    setDrafts(Object.fromEntries(providers.map(p => [p.provider, toDraft(p)])));
  }, [providers]);

  const patch = (prov: string, fn: (d: Draft) => Draft) =>
    setDrafts(ds => (ds[prov] ? { ...ds, [prov]: fn(ds[prov]) } : ds));
  const patchModel = (prov: string, idx: number, m: Partial<VeProviderModel>) =>
    patch(prov, d => ({ ...d, models: d.models.map((x, i) => (i === idx ? { ...x, ...m } : x)) }));
  const toggleReveal = (id: string) =>
    setRevealed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async (prov: string) => {
    const d = drafts[prov];
    if (!d) return;
    const models = d.models
      .filter(m => m.model.trim() !== '')
      .map(m => ({ ...m, model: m.model.trim(), unit: (m.unit || '').trim() || defaultUnit(m.kind) }));
    setSaving(prov); setMsg(s => ({ ...s, [prov]: '' }));
    const key = d.api_key.trim();
    try {
      await saveVideoEditorProvider({
        provider: prov,
        label: d.label.trim() || prov,
        api_base: d.api_base.trim(),
        enabled: d.enabled,
        // Send the key only when it changed; an emptied field explicitly clears it.
        ...(key !== d.origKey ? (key ? { api_key: key } : { clear_key: true }) : {}),
        models,
      });
      setMsg(s => ({ ...s, [prov]: 'Saved.' }));
      onSaved();
    } catch (e: any) {
      setMsg(s => ({ ...s, [prov]: String(e?.message ?? e) }));
    } finally { setSaving(null); }
  };

  const addProvider = async () => {
    const id = newProv.provider.trim().toLowerCase();
    if (!id) { setNewMsg('Provider id is required.'); return; }
    if (providers.some(p => p.provider === id)) { setNewMsg('That provider already exists.'); return; }
    setAddingProv(true); setNewMsg(null);
    try {
      await saveVideoEditorProvider({ provider: id, label: newProv.label.trim() || id, api_base: '', enabled: true, models: [] });
      setNewProv({ provider: '', label: '' });
      onSaved();
    } catch (e: any) {
      setNewMsg(String(e?.message ?? e));
    } finally { setAddingProv(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Global settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          The platform-wide provider and model catalog for the video editor. Platform API keys entered
          here are the default for every user; roles (Packages) and users can override them. Models
          added here become selectable per role in the Packages tab.
        </p>
      </div>

      {providers.map(p => {
        const d = drafts[p.provider];
        if (!d) return null;
        const kinds = Array.from(new Set(d.models.map(m => m.kind)));
        return (
          <div key={p.provider} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Switch checked={d.enabled} onChange={v => patch(p.provider, x => ({ ...x, enabled: v }))} size="sm" />
                <span className={`font-mono text-sm font-semibold ${d.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{p.provider}</span>
                {kinds.map(k => (
                  <span key={k} className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${kindPill(k)}`}>{k}</span>
                ))}
              </div>
              <div className="text-xs text-gray-400">{p.updated_at && <>Last saved: {p.updated_at}</>}</div>
            </div>

            <div className="p-4 space-y-4">
              {/* Provider fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-xs text-gray-500">Label
                  <input className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800"
                         value={d.label} onChange={e => patch(p.provider, x => ({ ...x, label: e.target.value }))} />
                </label>
                <label className="text-xs text-gray-500">API base (optional)
                  <input className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono text-gray-800"
                         placeholder="https://…" value={d.api_base}
                         onChange={e => patch(p.provider, x => ({ ...x, api_base: e.target.value }))} />
                </label>
                <label className="text-xs text-gray-500">Platform API key
                  <span className="relative block">
                    <input type={revealed.has(p.provider) ? 'text' : 'password'} autoComplete="off"
                           placeholder="no key set"
                           value={d.api_key}
                           onChange={e => patch(p.provider, x => ({ ...x, api_key: e.target.value }))}
                           className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono pr-9 text-gray-800" />
                    <EyeButton revealed={revealed.has(p.provider)} onClick={() => toggleReveal(p.provider)} />
                  </span>
                  <span className="block mt-0.5 text-[11px] text-gray-400">
                    {d.api_key === '' ? (d.origKey ? 'Key will be removed on save.' : 'No platform key stored.') : 'Stored key — clear the field to remove it.'}
                  </span>
                </label>
              </div>

              {/* Model catalog */}
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2">Models</div>
                {d.models.length === 0 && <div className="text-xs text-gray-400 italic mb-2">No models yet — add one below.</div>}
                {d.models.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                          <th className="text-left font-semibold pb-1 pr-2">Model id</th>
                          <th className="text-left font-semibold pb-1 pr-2">Label</th>
                          <th className="text-left font-semibold pb-1 pr-2">Kind</th>
                          <th className="text-left font-semibold pb-1 pr-2">Cost</th>
                          <th className="text-left font-semibold pb-1 pr-2">Unit</th>
                          <th className="text-left font-semibold pb-1 pr-2" title="Id the editor client sends (defaults to the model id / known mapping)">Client id</th>
                          <th className="text-left font-semibold pb-1 pr-2">Frames</th>
                          <th className="pb-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {d.models.map((m, i) => (
                          <tr key={i} className="border-t border-gray-100 align-middle">
                            <td className="py-1.5 pr-2">
                              <input className="w-44 border border-gray-300 rounded px-2 py-1 text-xs font-mono" placeholder="model id"
                                     value={m.model} onChange={e => patchModel(p.provider, i, { model: e.target.value })} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input className="w-32 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="label"
                                     value={m.label ?? ''} onChange={e => patchModel(p.provider, i, { label: e.target.value })} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select className="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white" value={m.kind}
                                      onChange={e => patchModel(p.provider, i, { kind: e.target.value, unit: (m.unit || '') === defaultUnit(m.kind) ? defaultUnit(e.target.value) : m.unit })}>
                                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="number" min={0} step="0.0001" className="w-20 border border-gray-300 rounded px-2 py-1 text-xs tabular-nums"
                                     value={m.cost} onChange={e => patchModel(p.provider, i, { cost: Number(e.target.value) || 0 })} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input className="w-16 border border-gray-300 rounded px-2 py-1 text-xs" placeholder={defaultUnit(m.kind)}
                                     value={m.unit ?? ''} onChange={e => patchModel(p.provider, i, { unit: e.target.value })} />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-mono" placeholder="(auto)"
                                     value={m.client_id ?? ''} onChange={e => patchModel(p.provider, i, { client_id: e.target.value || undefined })} />
                            </td>
                            <td className="py-1.5 pr-2 whitespace-nowrap">
                              {m.kind === 'video' ? (
                                <span className="flex items-center gap-2 text-xs text-gray-600">
                                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!m.start_frame}
                                         onChange={e => patchModel(p.provider, i, { start_frame: e.target.checked })} /> start</label>
                                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!m.end_frame}
                                         onChange={e => patchModel(p.provider, i, { end_frame: e.target.checked })} /> end</label>
                                </span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="py-1.5 text-right">
                              <button onClick={() => patch(p.provider, x => ({ ...x, models: x.models.filter((_, j) => j !== i) }))}
                                      className="text-xs text-red-500 hover:text-red-700" title="Remove from catalog">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={() => patch(p.provider, x => ({ ...x, models: [...x.models, { model: '', label: '', kind: 'video', cost: 0, unit: 'sec' }] }))}
                        className="mt-2 px-2.5 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">+ Add model</button>
              </div>

              {/* Save bar */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
                {msg[p.provider] && <span className="text-xs text-gray-500">{msg[p.provider]}</span>}
                <button onClick={() => save(p.provider)} disabled={saving === p.provider}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving === p.provider ? 'Saving…' : 'Save provider'}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add a provider */}
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">Add a provider</div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="border border-gray-300 rounded px-2 py-1.5 text-sm font-mono w-40" placeholder="provider id"
                 value={newProv.provider} onChange={e => setNewProv(s => ({ ...s, provider: e.target.value }))} />
          <input className="border border-gray-300 rounded px-2 py-1.5 text-sm w-56" placeholder="label"
                 value={newProv.label} onChange={e => setNewProv(s => ({ ...s, label: e.target.value }))} />
          <button onClick={addProvider} disabled={addingProv}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40">{addingProv ? 'Adding…' : '+ Add'}</button>
        </div>
        {newMsg && <div className="text-xs text-gray-500 mt-2">{newMsg}</div>}
      </div>
    </div>
  );
}
