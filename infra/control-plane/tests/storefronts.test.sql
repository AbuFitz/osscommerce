-- Run against a database with migrations 0001-0004 applied. Raises on any failed expectation.
\set ON_ERROR_STOP on
begin;
insert into cp.stores(store_id, organisation_id, cell_id, region, lifecycle) values ('s_a','o1','c1','eu-west-london','live'), ('s_b','o2','c2','eu-west-london','live'), ('s_x','o3','c3','eu-west-london','suspended');
insert into cp.storefronts(storefront_id, store_id, name, env, state) values
 ('f_a_prod','s_a','A prod','production','live'), ('f_a_prev','s_a','A preview','preview','connected'),
 ('f_b_prod','s_b','B prod','production','live'), ('f_x','s_x','X','production','live'), ('f_a_off','s_a','A off','staging','disabled');
insert into cp.storefront_credentials(credential_id, storefront_id, purpose, secret_hash, prefix, expires_at) values
 ('c1','f_a_prod','server', sha256('secret-a-prod'), 'sa', now()+interval '1 day'),
 ('c2','f_b_prod','server', sha256('secret-b-prod'), 'sb', now()+interval '1 day'),
 ('c3','f_a_prev','server', sha256('secret-a-prev'), 'sp', now()+interval '1 day'),
 ('c4','f_x','server', sha256('secret-x'), 'sx', now()+interval '1 day'),
 ('c5','f_a_off','server', sha256('secret-a-off'), 'so', now()+interval '1 day');
insert into cp.storefront_credentials(credential_id, storefront_id, purpose, secret_hash, prefix, created_at, expires_at) values ('c6','f_a_prod','server', sha256('expired'), 'ex', now()-interval '2 day', now()-interval '1 day');
insert into cp.storefront_credentials(credential_id, storefront_id, purpose, secret_hash, prefix, expires_at, revoked_at) values ('c7','f_a_prod','server', sha256('revoked'), 'rv', now()+interval '1 day', now());

do $$ declare r record; begin
  select * into r from cp.resolve_storefront(sha256('secret-a-prod'),'server'); assert r.store_id = 's_a' and r.env = 'production' and r.live_orders, 'prod resolves to its own store';
  select * into r from cp.resolve_storefront(sha256('secret-b-prod'),'server'); assert r.store_id = 's_b', 'B resolves to B, never A';
  select * into r from cp.resolve_storefront(sha256('secret-a-prev'),'server'); assert r.store_id = 's_a' and r.env = 'preview' and not r.live_orders, 'preview cannot take live orders';
  assert not exists (select 1 from cp.resolve_storefront(sha256('expired'),'server')), 'expired credential refused';
  assert not exists (select 1 from cp.resolve_storefront(sha256('revoked'),'server')), 'revoked credential refused';
  assert not exists (select 1 from cp.resolve_storefront(sha256('secret-x'),'server')), 'suspended store refused';
  assert not exists (select 1 from cp.resolve_storefront(sha256('secret-a-off'),'server')), 'disabled storefront refused';
  assert not exists (select 1 from cp.resolve_storefront(sha256('secret-a-prod'),'revalidation')), 'purpose must match';
  assert not exists (select 1 from cp.resolve_storefront(sha256('guess'),'server')), 'unknown secret refused';
end $$;

-- a second live production storefront for the same store is impossible
savepoint s1;
do $$ begin
  begin insert into cp.storefronts(storefront_id, store_id, name, env, state) values ('f_a_prod2','s_a','dup','production','live'); raise exception 'duplicate live production accepted'; exception when unique_violation then null; end;
end $$;
-- a credential cannot outlive its creation instant
do $$ begin
  begin insert into cp.storefront_credentials(credential_id, storefront_id, purpose, secret_hash, prefix, expires_at) values ('bad','f_a_prod','server', sha256('z'), 'z', now()-interval '1 hour'); raise exception 'bad expiry accepted'; exception when check_violation then null; end;
end $$;

-- RLS: the runtime role sees only its own store, and cannot read credential hashes at all
insert into cp.storefront_hosts(host, storefront_id, store_id, verified) values ('a.example.com','f_a_prod','s_a',true), ('b.example.com','f_b_prod','s_b',true);
set local role oss_runtime;
select set_config('app.store_id','s_a', true);
do $$ begin
  assert (select count(*) from cp.storefronts) = 3, 'A sees only its three storefronts';
  assert (select count(*) from cp.storefront_hosts) = 1, 'A sees only its host';
  assert not exists (select 1 from cp.storefronts where store_id = 's_b'), 'A cannot see B';
  begin perform 1 from cp.storefront_credentials limit 1; raise exception 'credentials readable'; exception when insufficient_privilege then null; end;
  begin insert into cp.storefront_hosts(host, storefront_id, store_id) values ('evil.example.com','f_b_prod','s_b'); raise exception 'cross-store write accepted'; exception when insufficient_privilege or check_violation then null; end;
end $$;
select set_config('app.store_id','', true);
do $$ begin assert (select count(*) from cp.storefronts) = 0, 'no store context sees nothing'; end $$;
rollback;
\echo storefronts.test.sql: all expectations hold
