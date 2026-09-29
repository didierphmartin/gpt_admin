import { useState } from 'react';
import type { FormEvent } from 'react';
import { createAdmin } from '../api/setup';
import { useAuth } from '../contexts/AuthContext';
import { LLMSettingsPanel } from './LLMSettingsPanel';

const MIN_PASSWORD = 10;

/**
 * Corporate first-run setup. Shown only while the backend reports
 * needs_setup; the backend refuses a second administrator regardless.
 */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { loginCorporate } = useAuth();
  const [step, setStep] = useState<'admin' | 'llm'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`The password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    const created = await createAdmin(email, password, firstName, lastName);
    if (!created.success) {
      setBusy(false);
      setError(created.message || 'Could not create the administrator account.');
      return;
    }
    const signedIn = await loginCorporate(email, password);
    setBusy(false);
    if (!signedIn) {
      setError('The account was created, but signing in failed. Reload the page and sign in.');
      return;
    }
    setStep('llm');
  };

  const input = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  if (step === 'llm') {
    return (
      <div className="h-full overflow-y-auto bg-gray-100 py-10 px-4">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Setup · step 2 of 2</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">LLM access</h1>
            <p className="mt-2 text-sm text-gray-600">
              Add your company's provider keys. They apply to every user. You can change them later under Settings.
            </p>
          </div>
          <LLMSettingsPanel />
          <div className="flex justify-end">
            <button type="button" onClick={onDone}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center overflow-y-auto bg-gray-100 py-12 px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-lg bg-white p-8 shadow">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Setup · step 1 of 2 · for the administrator</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Administrator account</h1>
          <p className="mt-2 text-sm text-gray-600">
            This screen is for the person who will manage this installation. The account you create here
            signs in to both the app and the admin app, and it is the account that creates everyone else's.
          </p>
        </div>
        <label className="block text-sm font-medium text-gray-700">Email
          <input type="email" required autoComplete="username" value={email}
            onChange={e => setEmail(e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-gray-700">First name
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className={input} />
          </label>
          <label className="block text-sm font-medium text-gray-700">Last name
            <input value={lastName} onChange={e => setLastName(e.target.value)} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium text-gray-700">Password
          <input type="password" required autoComplete="new-password" value={password}
            onChange={e => setPassword(e.target.value)} className={input} />
          <span className="mt-1 block text-xs font-normal text-gray-500">At least {MIN_PASSWORD} characters.</span>
        </label>
        <label className="block text-sm font-medium text-gray-700">Confirm password
          <input type="password" required autoComplete="new-password" value={confirm}
            onChange={e => setConfirm(e.target.value)} className={input} />
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create administrator account'}
        </button>
      </form>
    </div>
  );
}
