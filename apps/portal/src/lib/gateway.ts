import { LAUNCH_GATES, type LaunchGate, type StoreRecord } from '@oss-commerce/contracts';

/** Payment, fulfilment and order state are independent axes (research/02). */
export type PaymentStatus = 'pending' | 'authorised' | 'paid' | 'failed' | 'partially_refunded' | 'refunded' | 'disputed';
export type FulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
export type OrderState = 'open' | 'cancelled' | 'completed';

export interface OrderLine { /** The engine's id for this line, needed to fulfil part of an order. */ id?: string; /** Which item this line is, needed to put returned goods back in stock. */ variantId?: string; sku: string; title: string; variant?: string; qty: number; /** How many of `qty` have already been sent. */ sent?: number; unitMinor: number; imageUrl?: string }
export interface OrderEvent { at: string; text: string; /** A note a team member wrote, as opposed to something that happened. */ note?: boolean; by?: string }
export interface Order {
  id: string; number: number; placedAt: string; customer: string; email: string;
  lines: OrderLine[]; shippingMinor: number; discountMinor: number; taxMinor: number; totalMinor: number;
  payment: PaymentStatus; fulfilment: FulfilmentStatus; state: OrderState;
  refundedMinor: number; timeline: OrderEvent[]; shipTo: string;
  /** Delivery town and country, kept apart from the display string so the live map can place the order. */
  ship?: { city?: string; country?: string };
  /** Set when an edit was started but not finished: still being edited, or waiting for the extra amount to be recorded. */
  editing?: 'modifying' | 'payment_due';
  /** How the customer paid, as reported by Stripe. Card number is never held: brand and last four only. */
  method?: { brand: 'visa' | 'mastercard' | 'amex'; last4: string; wallet?: 'applepay' | 'googlepay' | 'link' };
  /** How a hand-made order was paid (Cash, Bank transfer…). Card payments show as `method` instead. */
  paidBy?: string;
}
export interface Product { id: string; imageUrl?: string; title: string; status: 'draft' | 'published' | 'archived'; sku: string; priceMinor: number; onHand: number; allocated: number; threshold: number; variants: number }
export interface Customer { id: string; name: string; email: string; orders: number; spentMinor: number; lastOrder: string; marketing: boolean }
import type { SegmentDefinition } from '@oss-commerce/contracts';
/** A customer segment the merchant saved: a name and rules. Who is in it is worked out from orders each time it is shown. */
export interface SavedSegment { id: string; name: string; definition: SegmentDefinition }
export interface CustomerNote { id: string; text: string; at: string; by?: string }
export interface CustomerDetail extends Customer {
  firstName: string; lastName: string; phone: string; since: string; addresses: string[]; aovMinor: number;
  recentOrders: { id: string; number: number; placedAt: string; totalMinor: number; payment: PaymentStatus; fulfilment: FulfilmentStatus; items: string }[]; notes: CustomerNote[];
}
/** One thing that can go on a hand-made order. */
export interface OrderableItem { variantId: string; productId: string; title: string; variant?: string; sku: string; priceMinor: number; available: number }
export interface ManualOrderInput {
  customer: { id: string } | { email: string; firstName: string; lastName: string; phone?: string };
  items: { variantId: string; qty: number }[];
  shippingMethodId?: string; address?: { fullName: string; line1: string; line2?: string; city: string; postcode: string };
  coupon?: string; note?: string; payment: 'cash' | 'card_in_person' | 'bank_transfer' | 'other';
}
/** A checkout someone started and did not finish: they gave an email, so it can be followed up. */
export interface AbandonedCheckout { id: string; code: string; name?: string; email: string; /** Whether they got as far as paying, or only had things in a cart. */ stage: 'cart' | 'checkout'; lines: { title: string; variant?: string; qty: number; unitMinor: number }[]; totalMinor: number; lastActiveAt: string }
export interface AbandonedSummary { /** The moment the list was worked out, so "3 h ago" reads the same on server and browser. */ asOf: string; items: AbandonedCheckout[]; valueMinor: number; /** Carts with things in them but no email, which cannot be followed up. */ anonymous: number }
export interface ShippingChoice { id: string; name: string }
/** One sellable item's stock. `available` is what can still be sold (on hand minus reserved for open orders). */
export interface StockRow { variantId: string; productId: string; title: string; variant?: string; sku: string; imageUrl?: string; onHand: number; allocated: number; available: number; lowAt: number; tracked: boolean; backorder: boolean; status: 'ok' | 'low' | 'out' | 'backorder' | 'untracked'; published: boolean }
export interface StockMove { id: string; at: string; /** What happened: a sale, stock set aside for an order, released back, a return, or a change by hand. */ kind: 'sale' | 'reserved' | 'released' | 'returned' | 'adjusted'; quantity: number; orderId?: string; orderCode?: string; reason?: string; by?: string; note?: string }
export interface StockDetail extends StockRow { moves: StockMove[]; /** How many movements exist in all; the first page is in `moves`. */ totalMoves: number }
export interface VariantStockAdjust { variantId: string; mode: 'set' | 'add'; qty: number; reason: 'recount' | 'received' | 'damaged' | 'returned' | 'other'; note?: string; by?: string }
export interface StockSettings { tracked: boolean; backorder: boolean; lowAt: number }
export interface StockCountResult extends MutationResult { changed: number; unchanged: number; problems: { variantId: string; error: string }[] }
export interface CustomerProfile { firstName: string; lastName: string; phone: string }
export interface SalesPoint { day: string; netMinor: number; grossMinor: number }
export interface Summary { netMinor: number; grossMinor: number; orders: number; aovMinor: number; refundedMinor: number; toFulfil: number; lowStock: number; fulfilled: number; paidOrders: number; series: SalesPoint[]; topProducts: { title: string; netMinor: number }[]; statusMix: { label: string; count: number }[]; asOf: string }
export type DiscountKind = 'percent' | 'fixed' | 'shipping' | 'bogo' | 'custom';
export interface Discount {
  /** The engine's id, needed to edit, pause or delete it. */
  id?: string; name?: string;
  /** The code customers type. Empty for an automatic discount, which applies by itself when its conditions are met. */
  code: string; automatic?: boolean;
  kind: DiscountKind; value: number; status: 'active' | 'scheduled' | 'expired' | 'paused'; used: number; limit?: number; perCustomer?: number; window: string; minSpendMinor?: number;
  /** Product ids it is limited to; empty means the whole order. */
  productIds?: string[]; buy?: number; get?: number; startsAt?: string; endsAt?: string;
}
/** Everything the discount form can set. With `id` it changes an existing discount. */
export interface DiscountInput {
  id?: string; method: 'code' | 'automatic'; code?: string; name?: string; kind: Exclude<DiscountKind, 'custom'>; value: number; minSpendMinor?: number;
  productIds?: string[]; buy?: number; get?: number; limit?: number; perCustomer?: number; startDate?: string; endDate?: string; enabled: boolean;
}
export interface DiscountProduct { id: string; title: string; variantIds: string[] }
export interface StorefrontView {
  theme: { name: string; version: string; deployedAt: string; state: 'healthy' | 'building' | 'failed' };
  previewUrl: string; liveUrl: string | null; launchRequested?: boolean;
  checks: { label: string; ok: boolean; detail: string }[];
  history: { version: string; at: string; note: string; current: boolean }[];
}
export interface Member { id?: string; self?: boolean; name: string; email: string; role: 'owner' | 'manager' | 'fulfilment' | 'analyst'; status: 'active' | 'invited' }
export interface AccessGrant { id: string; who: string; purpose: string; scopes: string[]; write: boolean; state: 'pending' | 'active' | 'expired' | 'revoked'; expires: string }
/** When a delivery option is offered. Every limit is optional; none set means always offered. */
export interface RateWhen { minOrderMinor?: number; maxOrderMinor?: number; maxWeightGrams?: number }
export interface WeightBand { upToGrams: number; priceMinor: number }
/** One delivery option. Priced as a flat amount (optionally free over a spend), or by weight bands when `bands` is set. */
export interface ZoneRate { label: string; priceMinor: number; freeOverMinor?: number; when?: RateWhen; bands?: WeightBand[] }
export interface ShippingZone { name: string; /** Countries and/or UK postcode areas, ranges and outward codes, separated by commas. */ regions: string; rates: ZoneRate[] }
/** What the merchant sees about payments. Derived by the platform from Stripe's account state (see packages/payments readiness); the portal never interprets raw Stripe fields. */
export type PaymentSetupStatus = 'unknown' | 'not_started' | 'onboarding' | 'pending_verification' | 'action_required' | 'restricted' | 'enabled' | 'payouts_paused' | 'disconnected';
export interface PaymentSetup { status: PaymentSetupStatus; headline: string; detail: string; chargesEnabled: boolean; payoutsEnabled: boolean; checkoutAllowed: boolean; actionRequired: boolean; due: string[]; pending: string[]; deadline?: string; account?: string; applicationFeeBp: number; payoutSchedule?: string }
export type StartPaymentSetup = { ok: true; mode: 'hosted'; url: string } | { ok: false; message: string };
export interface ShippingTax { zones: ShippingZone[]; pricesIncludeTax: boolean; /** Items with no weight set, which count as zero when pricing or limiting by weight. Only reported when a delivery option uses weight. */ unweighed?: number; vatRegistered: boolean | null; payments: { account: string; capabilities: { label: string; ok: boolean }[]; applicationFeeBp: number; payouts: string } }
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
export interface NewProduct {
  title: string; priceMinor: number; sku?: string; status: 'draft' | 'published'; onHand: number;
  description?: string; compareAtMinor?: number; barcode?: string; weightGrams?: number; taxClass?: TaxClass; seoTitle?: string; seoDescription?: string; handle?: string;
}
export interface NewDiscount { code: string; kind: 'percent' | 'fixed' | 'shipping'; value: number; minSpendMinor?: number; limit?: number; endDate?: string }
export interface ZoneInput { originalName?: string; name: string; regions: string; rates: ZoneRate[] }
export interface StockAdjust { productId: string; mode: 'set' | 'add'; qty: number; reason: 'recount' | 'received' | 'damaged' | 'returned' | 'other' }
export interface DomainCheck { ok: boolean; message: string; record?: { type: string; name: string; value: string } }
/** One thing that needs the merchant's attention. The same list feeds the Overview alerts and the notification centre, so they never disagree. */
export interface Notice { id: string; tone: 'danger' | 'warn' | 'info' | 'success'; title: string; body: string; href: string; action: string; at: string; read: boolean; kind: 'payment' | 'stock' | 'order' | 'access' | 'quote' | 'setup' }
export interface LiveView { demo: boolean; asOf: string; visitorsNow: number; sessions: { value: number; vsPrev: number }; salesMinor: { value: number; vsPrev: number }; orders: { value: number; vsPrev: number }; behaviour: { activeCarts: number; checkingOut: number; purchased: number }; locations: { place: string; sessions: number }[]; points: import('./geo/points').MapPoint[]; recent: import('./geo/points').RecentOrder[]; tracked: boolean; returning: { newCustomers: number; returning: number } }
export interface Billing { demo: boolean; planName: string; monthlyMinor: number; buildMinor: number; status: 'not_started' | 'active' | 'past_due'; nextInvoiceAt?: string; invoices: { number: string; description: string; issuedAt: string; amountMinor: number; status: 'paid' | 'due' | 'overdue'; url?: string }[] }
export type TaxClass = 'standard' | 'reduced' | 'zero';
export interface OptionGroup { name: string; options: string[] }
export interface Variant { id: string; options: string[]; sku: string; priceMinor: number; onHand: number; allocated: number; taxClass: TaxClass; enabled: boolean; weightGrams?: number; compareAtMinor?: number; barcode?: string }
export interface ProductImage { id: string; url: string; name?: string }
export interface ProductDetail extends Product { optionGroups: OptionGroup[]; variantList: Variant[]; description: string; handle: string; seoTitle: string; seoDescription: string; images: ProductImage[] }
/** What the merchant can change about a product itself, as opposed to its variants (price, stock) which have their own editor. */
export interface ProductEdit { title: string; description: string; handle: string; seoTitle: string; seoDescription: string; status: 'draft' | 'published' }
export interface ImageUpload { name: string; type: string; bytes: Uint8Array }
export interface VariantInput { options: string[]; sku: string; priceMinor: number; stock: number; taxClass: TaxClass; enabled: boolean; weightGrams?: number; compareAtMinor?: number; barcode?: string }
/** A shelf of products. `rule`: products join by themselves when their name contains a word. `manual`: you pick them. `other`: set up another way (we can still delete it). */
export interface Collection { id: string; name: string; kind?: 'rule' | 'manual' | 'other'; contains: string; productIds?: string[]; count: number; products: string[] }
export interface CollectionInput { id?: string; name: string; kind: 'rule' | 'manual'; contains?: string; productIds?: string[] }
export interface MutationResult { ok: boolean; message: string; /** The id of what was created, when something was. */ id?: string; /** The step cannot finish until the person says how an extra amount was paid. */ needsPayment?: boolean; }
/** A refund, optionally for specific returned lines. Returned lines can be put back in stock. Our fee on the refunded part is returned by platform policy, not chosen per refund. */
export interface RefundInput { orderId: string; amountMinor: number; reason: string; restock: boolean; lines?: { lineId: string; qty: number }[] }
/** Changes to an order after it was placed. Quantities are the new totals (0 removes a line). */
export interface OrderEditInput { orderId: string; lines: { lineId: string; qty: number }[]; add: { variantId: string; qty: number }[]; surcharge?: { label: string; amountMinor: number }; address?: { fullName: string; line1: string; line2?: string; city: string; postcode: string }; note?: string }
export interface OrderEditPreview { ok: boolean; message: string; newTotalMinor: number; changeMinor: number; shippingMinor: number; lines: { title: string; variant?: string; qty: number; unitMinor: number; lineMinor: number }[] }
export interface OrderEditApply extends OrderEditInput { /** How an extra amount was paid, when the new total is higher. */ payment?: ManualOrderInput['payment']; reason?: string }
/** The only seam to the commerce service. Server-side only; the browser never holds engine credentials. */
export interface Viewer { name: string; initials: string; role: string; /** What this person can do. Owners manage staff; everyone else is limited by their role. */ kind: Member['role'] }
export interface ActivityEntry { id: number; at: string; actor: string; action: string; summary: string }
export interface ActivityPage { items: ActivityEntry[]; hasMore: boolean }
export const ROLE_INFO: Record<Member['role'], { label: string; blurb: string }> = {
  owner: { label: 'Owner', blurb: 'Everything, including delivery, payments and staff.' },
  manager: { label: 'Manager', blurb: 'Products, orders, customers, discounts and stock. Not delivery, payments or staff.' },
  fulfilment: { label: 'Fulfilment', blurb: 'Sees orders and customers, marks orders fulfilled and adds notes.' },
  analyst: { label: 'View only', blurb: 'Can look at everything on the list, but change nothing.' },
};
export interface CommerceGateway {
  /** Who is signed in. */
  viewer(): Promise<Viewer>;
  store(): Promise<StoreView>;
  summary(): Promise<Summary>;
  live(): Promise<LiveView>;
  /** The merchant's subscription to OneSimpleCommerce (platform billing account). Never the merchant's own Stripe Connect account. */
  billing(): Promise<Billing>;
  startBillingPortal(): Promise<StartPaymentSetup>;
  orders(q?: { filter?: string; q?: string }): Promise<Order[]>;
  /** Every order placed since `fromYmd` (a calendar day), for reports. Not paged for the screen. */
  reportOrders(fromYmd: string): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  products(): Promise<Product[]>;
  customers(): Promise<Customer[]>;
  customerSegments(): Promise<SavedSegment[]>;
  saveSegment(i: { id?: string; name: string; definition: SegmentDefinition }): Promise<MutationResult>;
  deleteSegment(id: string): Promise<MutationResult>;
  customer(id: string): Promise<CustomerDetail | null>;
  addCustomerNote(customerId: string, text: string): Promise<MutationResult>;
  stockRows(): Promise<StockRow[]>;
  stockMoves(variantId: string, page: number): Promise<StockMove[]>;
  stockDetail(variantId: string): Promise<StockDetail | null>;
  adjustVariantStock(a: VariantStockAdjust): Promise<MutationResult>;
  saveStockSettings(variantId: string, s: StockSettings): Promise<MutationResult>;
  /** Applies a shelf count: sets each counted item to what was counted, changes only what differs, and records it as a stock count. */
  applyStockCount(lines: { variantId: string; counted: number }[], by?: string, note?: string): Promise<StockCountResult>;
  /** Everything you can put on a hand-made order, with its price and what is in stock. */
  orderableItems(): Promise<OrderableItem[]>;
  shippingChoices(): Promise<ShippingChoice[]>;
  /** Takes an order yourself (phone, shop, message) and records how it was paid. Created and paid in one step; stock is reserved at once. */
  createManualOrder(i: ManualOrderInput): Promise<MutationResult>;
  deleteCustomerNote(customerId: string, noteId: string): Promise<MutationResult>;
  updateCustomerProfile(customerId: string, p: CustomerProfile): Promise<MutationResult>;
  /** Everything held about one customer, as a readable file (GDPR access request). */
  customerExport(customerId: string): Promise<string | null>;
  /** Removes a customer's personal details and keeps the sales. Refused while an order is unfinished. */
  eraseCustomer(customerId: string): Promise<MutationResult>;
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
  /** Fulfil an order, or only some of it when `lines` is given (quantities per line, by sku). */
  fulfilOrder(orderId: string, tracking?: string, lines?: { sku: string; qty: number }[]): Promise<MutationResult>;
  /** Cancel an order that has not shipped. Stock is released. With `refund`, the customer is also refunded in full. */
  cancelOrder(i: { orderId: string; reason: string; refund: boolean }): Promise<MutationResult>;
  /** A private note on the order, visible to the team only. */
  addOrderNote(orderId: string, note: string): Promise<MutationResult>;
  refundOrder(i: RefundInput): Promise<MutationResult>;
  previewOrderEdit(i: OrderEditInput): Promise<OrderEditPreview>;
  applyOrderEdit(i: OrderEditApply): Promise<MutationResult>;
  /** Finish an edit that was left part-way, so the order can be fulfilled or refunded normally again. */
  abandonedCheckouts(): Promise<AbandonedSummary>;
  resolveOrderEdit(orderId: string, payment?: ManualOrderInput['payment']): Promise<MutationResult>;
  /** Invites a team member by email. They choose their own password from the link, so nobody ever sees it. */
  inviteMember(i: { email: string; firstName: string; lastName: string; role: Exclude<Member['role'], 'owner'> }): Promise<MutationResult>;
  setMemberRole(id: string, role: Exclude<Member['role'], 'owner'>): Promise<MutationResult>;
  removeMember(id: string): Promise<MutationResult>;
  /** Sends a fresh invitation link to someone who has not accepted yet. The earlier link stops working. */
  resendInvite(id: string): Promise<MutationResult>;
  /** What your team has done, newest first. Pass the last id you have to get the next page. */
  activity(q?: { before?: number; actor?: string }): Promise<ActivityPage>;
  changePassword(current: string, next: string): Promise<MutationResult>;
  rollbackTheme(version: string): Promise<MutationResult>;
  decideGrant(id: string, decision: 'approve' | 'decline' | 'revoke'): Promise<MutationResult>;
  savePreferences(prefs: Preferences): Promise<MutationResult>;
  product(id: string): Promise<ProductDetail | null>;
  saveVariants(productId: string, d: { optionGroups: OptionGroup[]; variants: VariantInput[] }): Promise<MutationResult>;
  collections(): Promise<Collection[]>;
  previewCollection(contains: string): Promise<{ count: number; products: string[] }>;
  createCollection(name: string, contains: string): Promise<MutationResult>;
  saveCollection(c: CollectionInput): Promise<MutationResult>;
  deleteCollection(id: string): Promise<MutationResult>;
  notices(): Promise<Notice[]>;
  markNoticesRead(ids: string[] | 'all'): Promise<MutationResult>;
  addProduct(p: NewProduct): Promise<MutationResult>;
  updateProduct(id: string, e: ProductEdit): Promise<MutationResult>;
  deleteProduct(id: string): Promise<MutationResult>;
  /** Adds photos to a product. The first photo becomes the main one when there is none. Photos are checked (type, size) before anything is stored. */
  uploadProductImages(id: string, files: ImageUpload[]): Promise<MutationResult>;
  /** Sets which photos a product has and their order. The first is the main photo. Photos left out are removed from the product. */
  setProductImages(id: string, orderedIds: string[]): Promise<MutationResult>;
  importProducts(rows: NewProduct[]): Promise<MutationResult>;
  adjustStock(a: StockAdjust): Promise<MutationResult>;
  createDiscount(d: NewDiscount): Promise<MutationResult>;
  discountProducts(): Promise<DiscountProduct[]>;
  saveDiscount(d: DiscountInput): Promise<MutationResult>;
  setDiscountEnabled(id: string, enabled: boolean): Promise<MutationResult>;
  deleteDiscount(id: string): Promise<MutationResult>;
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
