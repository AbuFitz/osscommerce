\set ON_ERROR_STOP on
begin;
insert into cp.stores(store_id, organisation_id, cell_id, region, lifecycle) values ('p_a','o1','c1','eu-west-london','live'),('p_b','o2','c2','eu-west-london','live');
insert into cp.payment_accounts(store_id, stripe_account_id, status) values ('p_a','acct_AAA','enabled'),('p_b','acct_BBB','onboarding');
do $$ begin
  begin insert into cp.payment_accounts(store_id, stripe_account_id, status) values ('p_a','acct_AAA2','enabled'); raise exception 'second account for a store accepted'; exception when unique_violation then null; end;
  begin insert into cp.payment_accounts(store_id, stripe_account_id, status) values ('p_b','acct_AAA','enabled'); raise exception 'one Stripe account bound to two stores'; exception when unique_violation then null; end;
  begin insert into cp.payment_accounts(store_id, stripe_account_id, status) values ('p_b','not-an-account','enabled'); raise exception 'bad id'; exception when check_violation or unique_violation then null; end;
end $$;
insert into cp.ledger_entries(store_id, source_id, kind, order_code, gross, processing_fee, application_fee, net, currency, occurred_at) values ('p_a','txn_1','sale','A1',10000,150,50,9800,'gbp',now());
do $$ begin
  begin update cp.ledger_entries set gross = 1; raise exception 'ledger updated'; exception when raise_exception then if sqlerrm <> 'cp.ledger_entries is append-only' then raise; end if; end;
  begin delete from cp.ledger_entries; raise exception 'ledger deleted'; exception when raise_exception then if sqlerrm <> 'cp.ledger_entries is append-only' then raise; end if; end;
  begin insert into cp.ledger_entries(store_id, source_id, kind, gross, processing_fee, application_fee, net, currency, occurred_at) values ('p_a','txn_1','sale',1,0,0,1,'gbp',now()); raise exception 'duplicate source id accepted'; exception when unique_violation then null; end;
end $$;
insert into cp.integration_connections(id, store_id, provider_id, env, state) values ('i1','p_a','postcodes_io','live','available');
do $$ begin
  begin insert into cp.integration_connections(id, store_id, provider_id, env, state) values ('i2','p_a','postcodes_io','live','available'); raise exception 'duplicate connection'; exception when unique_violation then null; end;
  begin insert into cp.integration_connections(id, store_id, provider_id, env, state) values ('i3','p_a','ideal_postcodes','live','connected'); raise exception 'connected without credentials'; exception when check_violation then null; end;
end $$;
set local role oss_runtime; select set_config('app.store_id','p_a', true);
do $$ begin
  assert (select count(*) from cp.payment_accounts) = 1 and (select stripe_account_id from cp.payment_accounts) = 'acct_AAA', 'A sees only its account';
  assert (select count(*) from cp.ledger_entries) = 1 and (select count(*) from cp.integration_connections) = 1, 'A sees only its rows';
  begin insert into cp.ledger_entries(store_id, source_id, kind, gross, processing_fee, application_fee, net, currency, occurred_at) values ('p_b','txn_x','sale',1,0,0,1,'gbp',now()); raise exception 'cross-store ledger write'; exception when insufficient_privilege or check_violation then null; end;
end $$;
select set_config('app.store_id','p_b', true);
do $$ begin assert (select count(*) from cp.ledger_entries) = 0 and (select stripe_account_id from cp.payment_accounts) = 'acct_BBB', 'B sees only its own'; end $$;
rollback;
\echo payments.test.sql: all expectations hold
