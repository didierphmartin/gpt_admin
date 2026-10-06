import { useEffect, useState } from 'react';
import { getUserAccount, type UserAccount } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { isWebAuthnSupported } from '../lib/webauthn';

interface AccountInfoProps {
  userId: number;
}

const PLAN_STYLES: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-300',
  standard: 'bg-blue-100 text-blue-700 border-blue-300',
  premium: 'bg-purple-100 text-purple-700 border-purple-300',
};

const ROLE_STYLES: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  user: 'bg-green-100 text-green-700 border-green-300',
  admin: 'bg-red-100 text-red-700 border-red-300',
};

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email + password',
  google: 'Google',
  facebook: 'Facebook',
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function AccountInfo({ userId }: AccountInfoProps) {
  const { user: currentUser, registerPasskey } = useAuth();
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passkeyState, setPasskeyState] = useState<{
    busy: boolean;
    message: string | null;
    kind: 'success' | 'error' | null;
  }>({ busy: false, message: null, kind: null });

  const isOwnAccount = currentUser?.id === userId;
  const passkeySupported = isWebAuthnSupported();

  const handleRegisterPasskey = async () => {
    setPasskeyState({ busy: true, message: null, kind: null });
    const result = await registerPasskey();
    setPasskeyState({
      busy: false,
      message: result.ok ? 'Passkey registered. You can now sign in with it.' : result.error || 'Passkey registration failed.',
      kind: result.ok ? 'success' : 'error',
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getUserAccount(userId)
      .then((data) => {
        if (!cancelled) {
          setAccount(data.account);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load account info');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading account information...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
  }

  if (!account) {
    return null;
  }

  const planClass = PLAN_STYLES[account.plan] || PLAN_STYLES.free;
  // A custom role has no style of its own: neutral, not the 'user' green.
  const roleClass = ROLE_STYLES[account.role] || 'bg-gray-100 text-gray-700 border-gray-300';
  const fullName = [account.first_name, account.last_name].filter(Boolean).join(' ') || '—';
  const percent = account.free_quota_percent ?? 0;
  const percentClamped = Math.min(100, Math.max(0, percent));
  const barColor =
    percentClamped >= 90
      ? 'bg-red-500'
      : percentClamped >= 70
      ? 'bg-yellow-500'
      : 'bg-blue-500';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Account</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Account</div>
            <div className="text-sm font-medium text-gray-900">{account.email}</div>
            <div className="text-xs text-gray-500 mt-1">{fullName}</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Plan</div>
            <span
              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded border ${planClass}`}
            >
              {account.plan}
            </span>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Role</div>
            <span
              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded border ${roleClass}`}
            >
              {account.role}
            </span>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total tokens</div>
            <div className="text-sm font-medium text-gray-900">
              {formatNumber(account.total_tokens)}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Login info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Auth provider</div>
            <div className="text-sm font-medium text-gray-900">
              {PROVIDER_LABELS[account.provider] || account.provider}
            </div>
            {account.has_firebase_uid && (
              <div className="text-xs text-gray-500 mt-1">Linked to Firebase</div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Email</div>
            <div className="text-sm font-medium text-gray-900 break-all">{account.email}</div>
            <div className="text-xs mt-1">
              {account.email_verified ? (
                <span className="text-green-700">✓ Verified</span>
              ) : (
                <span className="text-yellow-700">Not verified</span>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Phone</div>
            <div className="text-sm font-medium text-gray-900">{account.phone || '—'}</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Registered</div>
            <div className="text-sm font-medium text-gray-900">{formatTimestamp(account.created_at)}</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Last login</div>
            <div className="text-sm font-medium text-gray-900">{formatTimestamp(account.last_login)}</div>
          </div>

          {isOwnAccount && passkeySupported && (
            <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Passkey</div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Register a passkey on this device to sign in without a password.
                </div>
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={passkeyState.busy}
                  className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {passkeyState.busy ? 'Registering…' : 'Register passkey'}
                </button>
              </div>
              {passkeyState.message && (
                <div
                  className={`text-xs mt-2 ${
                    passkeyState.kind === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {passkeyState.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Token usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Token In</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatNumber(account.tokens_in)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Prompt tokens</div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Token Out</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatNumber(account.tokens_out)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Completion tokens</div>
          </div>
        </div>
      </div>

      {account.is_free_prospect && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Free trial quota</h3>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm text-gray-700">
                {formatNumber(account.total_tokens)} / {formatNumber(account.free_quota)} tokens
              </span>
              <span className="text-sm font-semibold text-gray-900">{percentClamped}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all`}
                style={{ width: `${percentClamped}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Free plan prospects are limited to {formatNumber(account.free_quota)} lifetime tokens.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
