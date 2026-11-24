export interface Resolved { storefrontId: string; storeId: string; env: 'development' | 'preview' | 'staging' | 'production'; liveOrders: boolean; cellId: string; configVersion: number }
/** Backed by cp.resolve_storefront(sha256(secret), 'server'). Returns null for unknown, expired, revoked, disabled or suspended. */
export interface Registry { resolve(secretHash: Buffer): Promise<Resolved | null> }
/** Where a cell lives and which Vendure channel is the merchant's. The channel token is a store SELECTOR and never leaves the platform. */
export interface CellDirectory { get(cellId: string): Promise<{ url: string; channelToken: string; mode: 'live' | 'test'; healthy: boolean } | null> }
export interface RateLimiter { take(key: string, cost?: number): boolean }
export interface IdempotencyStore { get(key: string): Promise<{ status: number; body: string } | undefined>; put(key: string, v: { status: number; body: string }): Promise<void> }
export interface Upstream { post(url: string, init: { headers: Record<string, string>; body: string; timeoutMs: number }): Promise<{ status: number; headers: Record<string, string>; body: string }> }
export interface Audit { record(e: { storefrontId?: string; storeId?: string; operation?: string; outcome: string; reason?: string; requestId: string }): void }
export interface PublishedContent { entry: string; revision: number; schemaVersion: number; body: unknown; publishedAt: string }
export interface ContentStore { get(storefrontId: string, entry: string): Promise<PublishedContent | null> }
export interface PublicPreferences { configVersion: number; guestCheckout: boolean; askMarketingConsent: boolean; showSoldOut: boolean; checkoutPaused: boolean }
export interface PreferencesStore { get(storefrontId: string): Promise<PublicPreferences | null> }
