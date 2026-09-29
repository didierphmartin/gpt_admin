import { getApiV1Base } from '../lib/backendConfig';

export interface SetupStatus {
  edition: string;
  needs_setup: boolean;
}

const LOGIN_API = '/login/backend/api/v1';

/** Unreachable or old backends read as "no setup needed", so the normal login shows. */
export async function getSetupStatus(): Promise<SetupStatus> {
  try {
    const res = await fetch(`${getApiV1Base()}/setup/status`);
    if (!res.ok) return { edition: '', needs_setup: false };
    const data = await res.json();
    return { edition: String(data.edition ?? ''), needs_setup: Boolean(data.needs_setup) };
  } catch {
    return { edition: '', needs_setup: false };
  }
}

export async function createAdmin(
  email: string, password: string, firstName: string, lastName: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${getApiV1Base()}/setup/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
    });
    const data = await res.json();
    return { success: Boolean(data.success), message: data.message };
  } catch {
    return { success: false, message: 'Could not reach the server. Please try again.' };
  }
}

export async function loginViaLoginService(
  email: string, password: string,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${LOGIN_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json();
    if (data.success && data.data?.access_token) return { ok: true, token: data.data.access_token };
    return { ok: false, message: data.message || 'Invalid email or password' };
  } catch {
    return { ok: false, message: 'Could not reach the login service. Please try again.' };
  }
}
