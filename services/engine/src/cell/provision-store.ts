import { MERCHANT_PERMISSIONS } from './merchant-role.ts';

/** Executes a platform-operator (superadmin) Admin API call. Provisioning is never done with a merchant's own session. */
export type OperatorExec = (query: string, variables?: Record<string, unknown>) => Promise<any>;

export interface NewStore { key: string; name: string; channelToken: string; owner: { email: string; password: string; firstName?: string; lastName?: string } }
export interface ProvisionedStore { channelId: string; stockLocationId: string; roleId: string; administratorId: string }

/**
 * Creates everything one store needs on the shared engine, idempotently:
 *  - a channel with its own token (prices include VAT, GBP, UK zone),
 *  - its OWN stock location (without one the store's stock reads as zero and is not isolated from others),
 *  - the Connect payment method assigned to the channel (payment methods are per channel),
 *  - a role limited to that channel and the merchant permission set (never SuperAdmin),
 *  - the owner's administrator login.
 * Tax categories, zones and countries are global to the engine and are created once at platform set-up, not here.
 */
export async function provisionStore(x: OperatorExec, s: NewStore): Promise<ProvisionedStore> {
  const code = `store-${s.key}`;
  const zone = (await x(`query{ zones{ items{ id } } }`)).zones.items[0]?.id; if (!zone) throw new Error('Platform set-up has not been run (no zone).');
  let channel = (await x(`query($c:String!){ channels(options:{ filter:{ code:{ eq:$c } } }){ items{ id } } }`, { c: code })).channels.items[0];
  if (!channel) { const r = (await x(`mutation($i:CreateChannelInput!){ createChannel(input:$i){ __typename ... on Channel { id } ... on ErrorResult { message } } }`, { i: { code, token: s.channelToken, defaultLanguageCode: 'en', pricesIncludeTax: true, currencyCode: 'GBP', defaultTaxZoneId: zone, defaultShippingZoneId: zone } })).createChannel; if (r.__typename !== 'Channel') throw new Error(r.message ?? 'Could not create the channel.'); channel = r; }
  const sl = `${s.name} stock`; let loc = (await x(`query($n:String!){ stockLocations(options:{ filter:{ name:{ eq:$n } } }){ items{ id } } }`, { n: sl })).stockLocations.items[0];
  if (!loc) loc = (await x(`mutation($n:String!){ createStockLocation(input:{ name:$n }){ id } }`, { n: sl })).createStockLocation;
  await x(`mutation($i:AssignStockLocationsToChannelInput!){ assignStockLocationsToChannel(input:$i){ id } }`, { i: { stockLocationIds: [loc.id], channelId: channel.id } });
  const pm = (await x(`query{ paymentMethods(options:{ filter:{ code:{ eq:"stripe-connect" } } }){ items{ id } } }`)).paymentMethods.items[0]; if (!pm) throw new Error('The Connect payment method is missing. Run platform set-up first.');
  await x(`mutation($i:AssignPaymentMethodsToChannelInput!){ assignPaymentMethodsToChannel(input:$i){ id } }`, { i: { paymentMethodIds: [pm.id], channelId: channel.id } });
  // Shipping methods are per channel as well. Every store starts with one flat-rate delivery option the merchant then edits.
  let sm = (await x(`query($c:String!){ shippingMethods(options:{ filter:{ code:{ eq:$c } } }){ items{ id } } }`, { c: `ship-${s.key}` })).shippingMethods.items[0];
  if (!sm) sm = (await x(`mutation($i:CreateShippingMethodInput!){ createShippingMethod(input:$i){ id } }`, { i: { code: `ship-${s.key}`, fulfillmentHandler: 'manual-fulfillment', checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }] }, calculator: { code: 'default-shipping-calculator', arguments: [{ name: 'rate', value: '495' }, { name: 'includesTax', value: 'include' }, { name: 'taxRate', value: '20' }] }, translations: [{ languageCode: 'en', name: 'Standard delivery' }] } })).createShippingMethod;
  await x(`mutation($i:AssignShippingMethodsToChannelInput!){ assignShippingMethodsToChannel(input:$i){ id } }`, { i: { shippingMethodIds: [sm.id], channelId: channel.id } });
  let role = (await x(`query($c:String!){ roles(options:{ filter:{ code:{ eq:$c } } }){ items{ id } } }`, { c: `owner-${s.key}` })).roles.items[0];
  if (!role) role = (await x(`mutation($i:CreateRoleInput!){ createRole(input:$i){ id } }`, { i: { code: `owner-${s.key}`, description: `Owner of ${s.name}`, permissions: MERCHANT_PERMISSIONS, channelIds: [channel.id] } })).createRole;
  let adm = (await x(`query($e:String!){ administrators(options:{ filter:{ emailAddress:{ eq:$e } } }){ items{ id } } }`, { e: s.owner.email })).administrators.items[0];
  if (!adm) adm = (await x(`mutation($i:CreateAdministratorInput!){ createAdministrator(input:$i){ id } }`, { i: { emailAddress: s.owner.email, firstName: s.owner.firstName ?? 'Store', lastName: s.owner.lastName ?? 'Owner', password: s.owner.password, roleIds: [role.id] } })).createAdministrator;
  return { channelId: channel.id, stockLocationId: loc.id, roleId: role.id, administratorId: adm.id };
}
