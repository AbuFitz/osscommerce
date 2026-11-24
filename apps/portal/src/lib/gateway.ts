import { LAUNCH_GATES, type LaunchGate, type StoreRecord } from '@oss-commerce/contracts';

/** Payment, fulfilment and order state are independent axes (research/02). */
export type PaymentStatus = 'pending' | 'authorised' | 'paid' | 'failed' | 'partially_refunded' | 'refunded' | 'disputed';
export type FulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
export type OrderState = 'open' | 'cancelled' | 'completed';

export interface OrderLine { sku: string; title: string; variant?: string; qty: number; unitMinor: number; imageUrl?: string }
export interface OrderEvent { at: string; text: string }
export interface Order {
  id: string; number: number; placedAt: string; customer: string; email: string;
  lines: OrderLine[]; shippingMinor: number; discountMinor: number; taxMinor: number; totalMinor: number;
  payment: PaymentStatus; fulfilment: FulfilmentStatus; state: OrderState;
  refundedMinor: number; timeline: OrderEvent[]; shipTo: string;
  /** How the customer paid, as reported by Stripe. Card number is never held: brand and last four only. */
  method?: { brand: 'visa' | 'mastercard' | 'amex'; last4: string; wallet?: 'applepay' | 'googlepay' | 'link' };
}
export interface Product { id: string; imageUrl?: string; title: string; status: 'draft' | 'published' | 'archived'; sku: string; priceMinor: number; onHand: number; allocated: number; threshold: number; variants: number }
export interface Customer { id: string; name: string; email: string; orders: number; spentMinor: number; lastOrder: string; marketing: boolean }
export interface SalesPoint { day: string; netMinor: number; grossMinor: number }
export interface Summary { netMinor: number; grossMinor: number; orders: number; aovMinor: number; refundedMinor: number; toFulfil: number; lowStock: number; fulfilled: number; paidOrders: number; series: SalesPoint[]; topProducts: { title: string; netMinor: number }[]; statusMix: { label: string; count: number }[]; asOf: string }
export interface Discount { code: string; kind: 'percent' | 'fixed' | 'shipping'; value: number; status: 'active' | 'scheduled' | 'expired'; used: number; limit?: number; window: string; minSpendMinor?: number }
export interface StorefrontView {
  theme: { name: string; version: string; deployedAt: string; state: 'healthy' | 'building' | 'failed' };
  previewUrl: string; liveUrl: string | null; launchRequested?: boolean;
  checks: { label: string; ok: boolean; detail: string }[];
  history: { version: string; at: string; note: string; current: boolean }[];
}
export interface Member { name: string; email: string; role: 'owner' | 'manager' | 'fulfilment' | 'analyst'; status: 'active' | 'invited' }
export interface AccessGrant { id: string; who: string; purpose: string; scopes: string[]; write: boolean; state: 'pending' | 'active' | 'expired' | 'revoked'; expires: string }
export interface ShippingZone { name: string; regions: string; rates: { label: string; priceMinor: number; freeOverMinor?: number }[] }
/** What the merchant sees about payments. Derived by the platform from Stripe's account state (see packages/payments readiness); the portal never interprets raw Stripe fields. */
export type PaymentSetupStatus = 'unknown' | 'not_started' | 'onboarding' | 'pending_verification' | 'action_required' | 'restricted' | 'enabled' | 'payouts_paused' | 'disconnected';
export interface PaymentSetup { status: PaymentSetupStatus; headline: string; detail: string; chargesEnabled: boolean; payoutsEnabled: boolean; checkoutAllowed: boolean; actionRequired: boolean; due: string[]; pending: string[]; deadline?: string; account?: string; applicationFeeBp: number; payoutSchedule?: string }
export type StartPaymentSetup = { ok: true; mode: 'hosted'; url: string } | { ok: false; message: string };
export interface ShippingTax { zones: ShippingZone[]; pricesIncludeTax: boolean; vatRegistered: boolean | null; payments: { account: string; capabilities: { label: string; ok: boolean }[]; applicationFeeBp: number; payouts: string } }
export interface Readiness { gate: LaunchGate; label: string; done: boolean; hint: string }
export interface StoreView { name: string; store: StoreRecord; readiness: Readiness[] }

export interface ContentSection { id: string; type: 'hero' | 'image_text' | 'product_row' | 'announcement' | 'faq'; label: string; fields: Record<string, string>; changed: boolean }
export interface ContentView { page: { id: string; title: string; path: string }; sections: ContentSection[]; publishedAt: string; previewUrl: string; versions: { id: string; at: string; note: string; current: boolean }[] }
export interface LegalPage { slug: 'privacy' | 'terms' | 'shipping' | 'returns'; title: string; status: 'not_set_up' | 'draft' | 'published'; updatedAt?: string; body: string }
export interface Automation { id: string; name: string; trigger: string; action: string; kind: 'transactional' | 'operational' | 'marketing'; enabled: boolean; lastRun?: string; runsMonth: number; needsConsent?: boolean }
export interface AutomationRun { id: string; at: string; automation: string; event: string; outcome: 'sent' | 'skipped_no_consent' | 'failed_retrying' | 'failed'; detail: string }
export interface ServiceRequest { id: string; kind: 'product_upload' | 'design_change' | 'content' | 'integration' | 'other'; title: string; status: 'submitted' | 'quoted' | 'in_progress' | 'done' | 'declined'; quoteMinor?: number; createdAt: string; detail: string }
export interface EmailSettings { brand: { shopName: string; accent: string; supportEmail: string; footer: string }; notifications: Record<string, boolean>; sendingDomain: { host: string; verified: boolean } }
export interface Preferences { lowStock: boolean; newOrder: boolean; guest: boolean; consent: boolean; showSoldOut: boolean; pause: boolean }
export interface NewProduct { title: string; priceMinor: number; sku?: string; status: 'draft' | 'published'; onHand: number }
export interface NewDiscount { code: string; kind: 'percent' | 'fixed' | 'shipping'; value: number; minSpendMinor?: number; limit?: number; endDate?: string }
export interface ZoneInput { originalName?: string; name: string; regions: string; rates: { label: string; priceMinor: number; freeOverMinor?: number }[] }
export interface StockAdjust { productId: string; mode: 'set' | 'add'; qty: number; reason: 'recount' | 'received' | 'damaged' | 'returned' | 'other' }
export interface DomainCheck { ok: boolean; message: string; record?: { type: string; name: string; value: string } }
/** One thing that needs the merchant's attention. The same list feeds the Overview alerts and the notification centre, so they never disagree. */
export interface Notice { id: string; tone: 'danger' | 'warn' | 'info' | 'success'; title: string; body: string; href: string; action: string; at: string; read: boolean; kind: 'payment' | 'stock' | 'order' | 'access' | 'quote' | 'setup' }
export interface LiveView { demo: boolean; asOf: string; visitorsNow: number; sessions: { value: number; vsPrev: number }; salesMinor: { value: number; vsPrev: number }; orders: { value: number; vsPrev: number }; behaviour: { activeCarts: number; checkingOut: number; purchased: number }; locations: { place: string; sessions: number }[]; returning: { newCustomers: number; returning: number } }
export interface Billing { demo: boolean; planName: string; monthlyMinor: number; buildMinor: number; status: 'not_started' | 'active' | 'past_due'; nextInvoiceAt?: string; invoices: { number: string; description: string; issuedAt: string; amountMinor: number; status: 'paid' | 'due' | 'overdue' }[] }
export type TaxClass = 'standard' | 'reduced' | 'zero';
export interface OptionGroup { name: string; options: string[] }
export interface Variant { id: string; options: string[]; sku: string; priceMinor: number; onHand: number; allocated: number; taxClass: TaxClass; enabled: boolean; weightGrams?: number }
export interface ProductDetail extends Product { optionGroups: OptionGroup[]; variantList: Variant[] }
export interface VariantInput { options: string[]; sku: string; priceMinor: number; stock: number; taxClass: TaxClass; enabled: boolean; weightGrams?: number }
export interface Collection { id: string; name: string; contains: string; count: number; products: string[] }
export interface MutationResult { ok: boolean; message: string }
export interface RefundInput { orderId: string; amountMinor: number; reason: string; restock: boolean; refundFee: boolean }
/** The only seam to the commerce service. Server-side only; the browser never holds engine credentials. */
export interface Viewer { name: string; initials: string; role: string }
export interface CommerceGateway {
  /** Who is signed in. */
  viewer(): Promise<Viewer>;
  store(): Promise<StoreView>;
  summary(): Promise<Summary>;
  live(): Promise<LiveView>;
  /** The merchant's subscription to OneSimpleCommerce (platform billing account). Never the merchant's own Stripe Connect account. */
  billing(): Promise<Billing>;
  orders(q?: { filter?: string; q?: string }): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  products(): Promise<Product[]>;
  customers(): Promise<Customer[]>;
  discounts(): Promise<Discount[]>;
  storefront(): Promise<StorefrontView>;
  team(): Promise<{ members: Member[]; grants: AccessGrant[] }>;
  shippingTax(): Promise<ShippingTax>;
  paymentSetup(preview?: string): Promise<PaymentSetup>;
  startPaymentSetup(): Promise<StartPaymentSetup>;
  content(): Promise<ContentView>;
  legalPages(): Promise<LegalPage[]>;
  automations(): Promise<{ rules: Automation[]; runs: AutomationRun[]; runsLimit: number }>;
  serviceRequests(): Promise<ServiceRequest[]>;
  emailSettings(): Promise<EmailSettings>;
  preferences(): Promise<Preferences>;
  saveSection(sectionId: string, fields: Record<string, string>): Promise<MutationResult>;
  publishContent(): Promise<MutationResult>;
  saveLegal(slug: LegalPage['slug'], body: string, publish: boolean): Promise<MutationResult>;
  setAutomation(id: string, enabled: boolean): Promise<MutationResult>;
  createServiceRequest(kind: ServiceRequest['kind'], title: string, detail: string): Promise<MutationResult>;
  decideQuote(id: string, approve: boolean): Promise<MutationResult>;
  saveEmailSettings(brand: Partial<EmailSettings['brand']>, notifications: Record<string, boolean>): Promise<MutationResult>;
  fulfilOrder(orderId: string, tracking?: string): Promise<MutationResult>;
  refundOrder(i: RefundInput): Promise<MutationResult>;
  inviteMember(email: string, role: Member['role']): Promise<MutationResult>;
  rollbackTheme(version: string): Promise<MutationResult>;
  decideGrant(id: string, decision: 'approve' | 'decline' | 'revoke'): Promise<MutationResult>;
  savePreferences(prefs: Preferences): Promise<MutationResult>;
  product(id: string): Promise<ProductDetail | null>;
  saveVariants(productId: string, d: { optionGroups: OptionGroup[]; variants: VariantInput[] }): Promise<MutationResult>;
  collections(): Promise<Collection[]>;
  previewCollection(contains: string): Promise<{ count: number; products: string[] }>;
  createCollection(name: string, contains: string): Promise<MutationResult>;
  notices(): Promise<Notice[]>;
  markNoticesRead(ids: string[] | 'all'): Promise<MutationResult>;
  addProduct(p: NewProduct): Promise<MutationResult>;
  importProducts(rows: NewProduct[]): Promise<MutationResult>;
  adjustStock(a: StockAdjust): Promise<MutationResult>;
  createDiscount(d: NewDiscount): Promise<MutationResult>;
  saveZone(z: ZoneInput): Promise<MutationResult>;
  checkDomain(): Promise<DomainCheck>;
  requestLaunch(): Promise<MutationResult>;
}

export const GATE_COPY: Record<LaunchGate, { label: string; hint: string }> = {
  contract_signed: { label: 'Contract signed', hint: 'We send this to you to sign.' },
  payments_enabled: { label: 'Payments connected', hint: 'Connect Stripe to accept payments.' },
  domain_verified: { label: 'Domain verified', hint: 'Add the DNS record we show you.' },
  test_order_passed: { label: 'Test order placed', hint: 'Place a test order in preview.' },
  launch_approved: { label: 'Launch approved', hint: 'You approve once the rest is done.' },
};
export { LAUNCH_GATES };
