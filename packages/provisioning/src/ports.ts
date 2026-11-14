export type Env = 'development' | 'preview' | 'staging' | 'production';
export interface EnvVar { key: string; value: string; sensitive: boolean; targets: ('production' | 'preview' | 'development')[] }
export class ExternalError extends Error { constructor(msg: string, readonly retryable: boolean, readonly retryAfterMs?: number) { super(msg); } }

/** Everything the orchestrator needs from Vercel. Scoped to one team, with a token that cannot touch other teams or billing. */
export interface HostingPort {
  findProject(name: string): Promise<{ id: string } | null>;
  createProject(p: { name: string; framework: 'nextjs' }): Promise<{ id: string }>;
  upsertEnv(projectId: string, vars: EnvVar[]): Promise<void>;
  addDomain(projectId: string, domain: string): Promise<{ verified: boolean; dns: { type: string; name: string; value: string }[] }>;
  verifyDomain(projectId: string, domain: string): Promise<{ verified: boolean }>;
}
/** Persistence for the registry + step ledger. The ledger holds ids and states only: never secrets. */
export interface RegistryPort {
  getStep(runId: string, step: string): Promise<{ status: string; externalId?: string; attempts: number } | null>;
  saveStep(runId: string, step: string, s: { status: 'running' | 'done' | 'failed'; externalId?: string; error?: string }): Promise<void>;
  createCredentials(storefrontId: string, creds: { purpose: 'server' | 'revalidation'; hash: Buffer; prefix: string; expiresAt: Date }[]): Promise<void>;
  revokeCredentials(storefrontId: string): Promise<void>;
  setStorefrontState(storefrontId: string, state: 'connected'): Promise<void>;
  audit(e: { runId: string; storeId: string; step: string; outcome: string; detail?: string }): Promise<void>;
}
