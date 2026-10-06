// User types
// A role key: a built-in role (guest, prospect, user, admin, robot) or a custom
// one created on the Roles & packages page (`^[a-z0-9]+(-[a-z0-9]+)*$`).
export type UserRole = string;

// The built-in roles; the robot is the service account, never a person's role.
export const BUILTIN_ROLES = ['guest', 'prospect', 'user', 'admin', 'robot'] as const;
export const ROBOT_ROLE = 'robot';

export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  provider: 'email' | 'google' | 'facebook';
  created_at: string;
  updated_at: string;
}

// App key types
// An app key is a scoped, revocable credential that lets client code call
// the backend on behalf of a user without that user's login JWT. Managed
// here in gpt_admin via the per-user "App Keys" tab.

export interface AppKey {
  id: number;
  user_id: number;
  application_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Mint response — same as AppKey plus the one-time-visible full key. The
// backend does NOT echo last_used_at / revoked_at on create (both null).
export interface AppKeyMintResult {
  id: number;
  user_id: number;
  application_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  full_key: string;
  created_at: string;
}

// A workflow the admin can scope an app key to. The App Keys panel offers
// these as a pick-by-name checklist; each picked id becomes a
// `workflows:run:<id>` scope.
export interface WorkflowOption {
  id: number;
  name: string;
}

// An agent the admin can scope an app key to. Same shape as WorkflowOption;
// each picked id becomes an `agents:run:<id>` scope.
export interface AgentOption {
  id: number;
  name: string;
}

// Package / capability types
// A package is a bundle of features the backend exposes to each user role.
// Admins edit these in gpt_admin; gpt reads /api/v1/me/package on boot to
// gate providers, MCP servers, sidebar items, and quotas.

export interface PackageProviderConfig {
  enabled: boolean;
  default_api_key?: string | null;
  default_model?: string | null;
}

export interface PackageSidebarFlags {
  conversations: boolean;
  verifier: boolean;
  compare: boolean;
  prompt_library: boolean;
  skills: boolean;
  agent_teams: boolean;
  file_storage: boolean;
}

export interface PackageCapabilities {
  providers: Record<string, PackageProviderConfig>;
  // null = allow all; array = explicit allowlist (names)
  mcp_servers: string[] | null;
  skills: string[] | null;
  sidebar: PackageSidebarFlags;
  // null = no cap
  quota_tokens: number | null;
  voice: boolean;
  avatar: boolean;
  // People in this role may publish playbooks to the robot (default false).
  use_robot?: boolean;
}

export interface Package {
  role: UserRole;
  // Display name and built-in flag (absent on backends without custom roles).
  name?: string;
  builtin?: boolean;
  capabilities: PackageCapabilities;
  updated_at: string | null;
}

// A role as GET /api/v1/admin/roles lists it (built-ins first).
export interface Role {
  role: UserRole;
  name: string;
  builtin: boolean;
  capabilities: Partial<PackageCapabilities>;
  // How many people (not the robot) hold the role.
  used_by: number;
}

// Provider settings types
export type ProviderCategory = 'avatar' | 'voice';

export interface ProviderConfig {
  has_key: boolean;
  api_key: string | null;
  settings: Record<string, unknown> | null;
  enabled?: boolean;
}

export interface CategorySettings {
  active: string | null;
  enabled: boolean;
  providers: Record<string, ProviderConfig>;
}

export interface ProviderSettings {
  avatar: CategorySettings;
  voice: CategorySettings;
}

// LLM API keys types
export interface ApiKeyInfo {
  api_key: string | null;
  masked_key: string | null;
  model: string | null;
  base_url: string | null;
  max_tokens: number | null;
  temperature: number | null;
  chat_endpoint: string | null;
  streaming: boolean | null;
  supports_tools: boolean | null;
  system_prompt: string | null;
  enabled: boolean;
  updated_at: string | null;
  // Where this provider's key comes from for the user being viewed:
  //  'user'    – a personal per-user override (user_api_keys)
  //  'package' – inherited from the user's package/role (admin can override per-user)
  //  'none'    – not available (no personal key, package doesn't provide one)
  source?: 'user' | 'package' | 'none';
  available?: boolean;
  package_name?: string | null;
}

// Payload for saving a single provider's key + settings.
// Any field omitted is left unchanged; api_key is only required when creating the row.
export interface ApiKeySavePayload {
  api_key?: string;
  model?: string | null;
  base_url?: string | null;
  max_tokens?: number | null;
  temperature?: number | null;
  chat_endpoint?: string | null;
  streaming?: boolean | null;
  supports_tools?: boolean | null;
  system_prompt?: string | null;
  enabled?: boolean;
}

export type LLMProvider = 'claude' | 'openai' | 'gemini' | 'grok' | 'deepseek' | 'kimi' | 'gamma4';

// Routers (Jev) store a key like an LLM provider but are NOT chat providers:
// they never belong in LLM_PROVIDERS, a model/price list or fill-from-global.
export type RouterProvider = 'jev';
export const ROUTER_PROVIDERS: RouterProvider[] = ['jev'];
// system_llm_settings.api_format of a router row; the backend requires it on every save of one.
export const ROUTER_API_FORMAT = 'router';

export function isRouterRow(row: { api_format?: string | null }): boolean {
  return row.api_format === ROUTER_API_FORMAT;
}

export type ApiKeys = Record<LLMProvider | RouterProvider, ApiKeyInfo>;

// Avatar/Voice provider names
export const AVATAR_PROVIDERS = ['did', 'anam', 'heygen', 'tavus'] as const;
export const VOICE_PROVIDERS = ['grok', 'gemini', 'hume', 'elevenlabs'] as const;
export const LLM_PROVIDERS: LLMProvider[] = ['claude', 'openai', 'gemini', 'grok', 'deepseek', 'kimi', 'gamma4'];

export type AvatarProvider = typeof AVATAR_PROVIDERS[number];
export type VoiceProvider = typeof VOICE_PROVIDERS[number];

// System LLM Provider Configuration
export interface LLMProviderConfig {
  id: number | null;
  provider_key: string;
  display_name: string;
  api_key_masked?: string;
  api_key?: string;
  model: string;
  base_url: string | null;
  max_tokens: number;
  temperature: number;
  price_input_per_1m: number | null;
  price_output_per_1m: number | null;
  chat_endpoint: string | null;
  streaming: boolean;
  supports_tools: boolean;
  supported_models: string[];
  api_format: 'openai' | 'anthropic' | 'gemini' | typeof ROUTER_API_FORMAT;
  system_prompt: string | null;
  enabled: boolean;
  sort_order: number;
}
