import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { signInWithGoogle, signInWithFacebook } from '../lib/firebase';
import type { FirebaseUserData } from '../lib/firebase';
import { base64UrlDecode, base64UrlEncode } from '../lib/webauthn';
import { loginPortfolio, loginPortfolioWithFirebase } from '../api/portfolio';
import { captureSsoToken } from '../lib/sso';
import { loginViaLoginService } from '../api/setup';

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export type ManagedApp = 'synergy' | 'portfolio' | 'ai_backend' | 'ledger' | 'video_editor' | 'login';

interface AuthState {
  token: string | null;
  portfolioToken: string | null;
  user: User | null;
  app: ManagedApp | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  loginWithSso: (loginToken: string) => Promise<boolean>;
  loginCorporate: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithFacebook: () => Promise<boolean>;
  loginWithPasskey: () => Promise<boolean>;
  registerPasskey: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  selectApp: (app: ManagedApp) => void;
  exitApp: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

import { getApiV1Base } from '../lib/backendConfig';

const API_BASE = getApiV1Base();

/** 'unreachable' is kept distinct from 'invalid' so a stopped backend cannot end a session. */
type VerifyResult = 'valid' | 'invalid' | 'unreachable';

function getStoredToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('voice_token') || null;
}

function getStoredPortfolioToken(): string | null {
  return localStorage.getItem('portfolio_token');
}

function getStoredApp(): ManagedApp | null {
  const v = localStorage.getItem('selected_app');
  return v === 'synergy' || v === 'portfolio' ? v : null;
}

const EMPTY_STATE: AuthState = {
  token: null,
  portfolioToken: null,
  user: null,
  app: null,
  isLoading: false,
  error: null,
};

function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    }
    return false;
  } catch {
    return true;
  }
}

function parseUserFromToken(token: string): Partial<User> | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.user_id || payload.sub,
      email: payload.email || '',
      role: payload.role || 'user',
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...EMPTY_STATE,
    isLoading: true,
  });

  // Verify token with server
  // Three outcomes, not two. "The server rejected this token" and "I could not reach the
  // server" both used to come back as false, and the caller deleted the session for either
  // one — so a backend that was merely stopped silently logged the admin out, and the
  // stored token was gone by the time the backend came back.
  const verifyToken = useCallback(async (token: string): Promise<VerifyResult> => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'verify' }),
      });
    } catch {
      return 'unreachable'; // network-level failure: nothing is listening
    }

    try {
      const data = await response.json();
      return data.success === true ? 'valid' : 'invalid';
    } catch {
      return 'invalid'; // the server answered, just not with a verdict we understand
    }
  }, []);

  // SSO exchange — mirrors `login` below (same response shape, same admin
  // gate), but the login-service token stands in for email/password.
  // Defined here (ahead of the init effect) so it's initialized before that
  // effect's dependency array evaluates it.
  const loginWithSso = useCallback(async (loginToken: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sso_exchange', login_token: loginToken }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        const token = data.data.access_token;
        const user = data.data.user;
        if (user.role !== 'admin') {
          setState({ ...EMPTY_STATE, error: 'Access denied. Admin privileges required.' });
          return false;
        }
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (data.data.refresh_token) {
          localStorage.setItem('refresh_token', data.data.refresh_token);
        }
        // The SSO exchange carries no password or Firebase idToken, so unlike
        // the password/social flows below we cannot soft-log the admin into
        // PortfolioManagement here (same gap as the passkey flow further
        // down). Clear any stale portfolio session rather than leave it
        // attached to whoever was last authenticated.
        localStorage.removeItem('portfolio_token');

        setState({ ...EMPTY_STATE, token, user, app: null });
        return true;
      }
      setState({ ...EMPTY_STATE, error: data.message || 'SSO sign-in failed. Please try again.' });
      return false;
    } catch {
      setState({ ...EMPTY_STATE, error: 'SSO sign-in failed. Please try again.' });
      return false;
    }
  }, []);

  // Corporate edition: the login service holds the password; loginWithSso
  // exchanges its token for the gpt session and applies the admin check.
  const loginCorporate = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await loginViaLoginService(email, password);
    if (!result.ok) {
      setState({ ...EMPTY_STATE, error: result.message });
      return false;
    }
    return loginWithSso(result.token);
  }, [loginWithSso]);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      const ssoToken = captureSsoToken();
      if (ssoToken) {
        await loginWithSso(ssoToken);
        return;
      }

      const token = getStoredToken();
      const user = getStoredUser();

      if (!token) {
        setState(EMPTY_STATE);
        return;
      }

      // Check if token is expired locally first
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setState(EMPTY_STATE);
        return;
      }

      // Verify token with server
      const verdict = await verifyToken(token);
      if (verdict === 'invalid') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setState(EMPTY_STATE);
        return;
      }
      // 'unreachable': keep the session. Only the server can invalidate a token, and it
      // did not get the chance — discarding it here would force a re-login for what is
      // usually a backend someone forgot to start. BackendHealthBanner explains the
      // state, and every real request is still authorized server-side.

      // If we have token but no stored user, extract from token
      const finalUser = user || (parseUserFromToken(token) as User);

      // Check if user is admin
      if (finalUser?.role !== 'admin') {
        setState({
          ...EMPTY_STATE,
          error: 'Access denied. Admin privileges required.',
        });
        return;
      }

      setState({
        ...EMPTY_STATE,
        token,
        portfolioToken: getStoredPortfolioToken(),
        user: finalUser,
        app: getStoredApp(),
      });
    };

    initAuth();
  }, [verifyToken, loginWithSso]);

  // Periodic token validation
  useEffect(() => {
    if (!state.token) return;

    const interval = setInterval(() => {
      const token = getStoredToken();
      if (!token || isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setState(EMPTY_STATE);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [state.token]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const token = data.data.access_token;
        const user = data.data.user;

        // Check if user is admin
        if (user.role !== 'admin') {
          setState({
            ...EMPTY_STATE,
            error: 'Access denied. Admin privileges required.',
          });
          return false;
        }

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (data.data.refresh_token) {
          localStorage.setItem('refresh_token', data.data.refresh_token);
        }

        // Also authenticate against PortfolioManagement so the admin can manage
        // both apps from a single sign-in. Soft-fail: if portfolio auth fails
        // (e.g. backend down or user not provisioned there), still let them in
        // — they just won't be able to enter the portfolio app.
        let portfolioToken: string | null = null;
        try {
          const portfolio = await loginPortfolio(email, password);
          portfolioToken = portfolio.access_token;
          localStorage.setItem('portfolio_token', portfolioToken);
        } catch (e) {
          console.warn('[gpt_admin] PortfolioManagement password login failed:', e);
          localStorage.removeItem('portfolio_token');
        }

        setState({
          ...EMPTY_STATE,
          token,
          portfolioToken,
          user,
          app: null,
        });
        return true;
      } else {
        setState({
          ...EMPTY_STATE,
          error: data.message || 'Login failed. Please check your credentials.',
        });
        return false;
      }
    } catch {
      setState({
        ...EMPTY_STATE,
        error: 'Login failed. Please try again.',
      });
      return false;
    }
  }, []);

  // Social login handler - shared logic for Google and Facebook
  const handleSocialLogin = useCallback(async (
    provider: 'google' | 'facebook',
    idToken: string,
    userData: FirebaseUserData
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'firebase',
          provider,
          idToken,
          userData,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const token = data.data.access_token;
        const user = data.data.user;

        // Check if user is admin
        if (user.role !== 'admin') {
          setState({
            ...EMPTY_STATE,
            error: 'Access denied. Admin privileges required.',
          });
          return false;
        }

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (data.data.refresh_token) {
          localStorage.setItem('refresh_token', data.data.refresh_token);
        }

        // PortfolioManagement also accepts Firebase ID tokens at /auth/firebase
        // (same project as gpt). Soft-fail like the password flow: if portfolio
        // auth doesn't go through, the admin can still manage SynergyAI.
        let portfolioToken: string | null = null;
        try {
          const portfolio = await loginPortfolioWithFirebase(idToken, provider, {
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            provider_id: userData.firebase_uid,
          });
          portfolioToken = portfolio.access_token;
          localStorage.setItem('portfolio_token', portfolioToken);
        } catch (e) {
          console.warn('[gpt_admin] PortfolioManagement social login failed:', e);
          localStorage.removeItem('portfolio_token');
        }

        setState({
          ...EMPTY_STATE,
          token,
          portfolioToken,
          user,
        });
        return true;
      } else {
        setState({
          ...EMPTY_STATE,
          error: data.message || 'Social login failed. Please try again.',
        });
        return false;
      }
    } catch {
      setState({
        ...EMPTY_STATE,
        error: 'Social login failed. Please try again.',
      });
      return false;
    }
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { idToken, userData } = await signInWithGoogle();
      return await handleSocialLogin('google', idToken, userData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google login failed. Please try again.';
      setState({
        ...EMPTY_STATE,
        error: errorMessage,
      });
      return false;
    }
  }, [handleSocialLogin]);

  const loginWithFacebook = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { idToken, userData } = await signInWithFacebook();
      return await handleSocialLogin('facebook', idToken, userData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Facebook login failed. Please try again.';
      setState({
        ...EMPTY_STATE,
        error: errorMessage,
      });
      return false;
    }
  }, [handleSocialLogin]);

  const loginWithPasskey = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const challengeRes = await fetch(`${API_BASE}/webauthn/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate' }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeData.success || !challengeData.challenge) {
        setState({
          ...EMPTY_STATE,
          error: challengeData.message || 'Failed to start passkey sign-in.',
        });
        return false;
      }

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlDecode(challengeData.challenge),
          rpId: challengeData.rp_id,
          userVerification: 'required',
          timeout: 60000,
        },
        mediation: 'optional',
      })) as PublicKeyCredential | null;

      if (!assertion) {
        setState({
          ...EMPTY_STATE,
          error: 'Passkey sign-in was cancelled.',
        });
        return false;
      }

      const response = assertion.response as AuthenticatorAssertionResponse;
      const authRes = await fetch(`${API_BASE}/webauthn/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential_id: base64UrlEncode(assertion.rawId),
          client_data_json: base64UrlEncode(response.clientDataJSON),
          authenticator_data: base64UrlEncode(response.authenticatorData),
          signature: base64UrlEncode(response.signature),
        }),
      });
      const authData = await authRes.json();

      if (!authData.success || !authData.token || !authData.user) {
        setState({
          ...EMPTY_STATE,
          error: authData.message || 'Passkey sign-in failed.',
        });
        return false;
      }

      const token: string = authData.token;
      const user: User = {
        id: Number(authData.user.id),
        email: authData.user.email,
        first_name: authData.user.first_name,
        last_name: authData.user.last_name,
        role: authData.user.role,
      };

      if (user.role !== 'admin') {
        setState({
          ...EMPTY_STATE,
          error: 'Access denied. Admin privileges required.',
        });
        return false;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      // Passkey login does not produce a portfolio token; admins entering the
      // portfolio app afterwards will need a password sign-in.
      localStorage.removeItem('portfolio_token');

      setState({ ...EMPTY_STATE, token, user });
      return true;
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Passkey sign-in was cancelled or timed out.'
          : err instanceof Error
          ? err.message
          : 'Passkey sign-in failed.';
      setState({ ...EMPTY_STATE, error: message });
      return false;
    }
  }, []);

  const registerPasskey = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (!token || !user) {
      return { ok: false, error: 'You must be signed in to register a passkey.' };
    }

    try {
      const challengeRes = await fetch(`${API_BASE}/webauthn/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'register' }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeData.success || !challengeData.challenge) {
        return { ok: false, error: challengeData.message || 'Failed to start passkey registration.' };
      }

      const userIdBytes = new TextEncoder().encode(String(user.id));
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: base64UrlDecode(challengeData.challenge),
          rp: { id: challengeData.rp_id, name: challengeData.rp_name || 'GPT Admin' },
          user: {
            id: userIdBytes,
            name: user.email,
            displayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          attestation: 'none',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        return { ok: false, error: 'Passkey registration was cancelled.' };
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey?.();
      if (!publicKey) {
        return { ok: false, error: 'This device did not return a usable public key.' };
      }

      const registerRes = await fetch(`${API_BASE}/webauthn/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credential_id: base64UrlEncode(credential.rawId),
          public_key: base64UrlEncode(publicKey),
          client_data_json: base64UrlEncode(response.clientDataJSON),
          attestation_object: base64UrlEncode(response.attestationObject),
        }),
      });
      const registerData = await registerRes.json();
      if (!registerData.success) {
        return { ok: false, error: registerData.message || 'Passkey registration failed.' };
      }

      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Passkey registration was cancelled or timed out.'
          : err instanceof Error
          ? err.message
          : 'Passkey registration failed.';
      return { ok: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('portfolio_token');
    localStorage.removeItem('selected_app');
    setState(EMPTY_STATE);
  }, []);

  const selectApp = useCallback((app: ManagedApp) => {
    localStorage.setItem('selected_app', app);
    setState(prev => ({ ...prev, app }));
  }, []);

  const exitApp = useCallback(() => {
    localStorage.removeItem('selected_app');
    setState(prev => ({ ...prev, app: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    loginWithSso,
    loginCorporate,
    loginWithGoogle,
    loginWithFacebook,
    loginWithPasskey,
    registerPasskey,
    logout,
    selectApp,
    exitApp,
    isAuthenticated: !!state.token && !!state.user,
    isAdmin: state.user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
