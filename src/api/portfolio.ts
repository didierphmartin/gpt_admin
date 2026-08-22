const PORTFOLIO_API_BASE = '/PortfolioManagement/backend/portfolio-service';

export interface PortfolioLoginResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
}

export interface PortfolioUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'prospect' | 'user' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  token_limit: number;
  token_used: number;
  billing_period_start: string | null;
  email_verified: number;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioPagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PortfolioListUsersResult {
  users: PortfolioUser[];
  pagination: PortfolioPagination;
}

export async function loginPortfolio(email: string, password: string): Promise<PortfolioLoginResult> {
  const res = await fetch(`${PORTFOLIO_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.success || !json.data?.access_token) {
    throw new Error(json.message || 'Portfolio login failed.');
  }
  return json.data as PortfolioLoginResult;
}

export interface PortfolioFirebaseUserData {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  provider_id?: string | null;
}

export async function loginPortfolioWithFirebase(
  idToken: string,
  provider: 'google' | 'facebook',
  userData: PortfolioFirebaseUserData = {}
): Promise<PortfolioLoginResult> {
  // PortfolioManagement's /auth/firebase auto-registers unknown users only
  // when action='register'. Try login first; if the account doesn't exist,
  // retry as register. Mirrors the existing PortfolioManagement frontend.
  const post = (action: 'login' | 'register') =>
    fetch(`${PORTFOLIO_API_BASE}/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: idToken, action, provider, ...userData }),
    }).then(r => r.json());

  let json = await post('login');
  if (!json.success && /not found|does not exist/i.test(json.message || '')) {
    json = await post('register');
  }
  if (!json.success || !json.data?.access_token) {
    throw new Error(json.message || 'Portfolio social login failed.');
  }
  return json.data as PortfolioLoginResult;
}

export interface ListPortfolioUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'prospect' | 'user' | 'admin';
  status?: 'active' | 'inactive' | 'suspended';
}

export async function listPortfolioUsers(
  token: string,
  params: ListPortfolioUsersParams = {}
): Promise<PortfolioListUsersResult> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.role) qs.set('role', params.role);
  if (params.status) qs.set('status', params.status);
  const url = `${PORTFOLIO_API_BASE}/admin/users${qs.toString() ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.message || 'Failed to load portfolio users.');
  }
  return json.data as PortfolioListUsersResult;
}
