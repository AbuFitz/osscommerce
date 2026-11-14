\set ON_ERROR_STOP on
begin;
insert into cp.stores(store_id, organisation_id, cell_id, region, lifecycle) values ('p_a','o1','c1','eu-west-london','live'),('p_b','o2','c2','eu-west-london','live');
insert into cp.legal_entities(entity_id, organisation_id, legal_name, company_number) values ('le_a','o1','A Ltd','11111111'),('le_b','o2','B Ltd','22222222'),('le_a2','o1','A Holdings Ltd','33333333');
insert into cp.payment_accounts(payment_account_id, entity_id, stripe_account_id, api_version, status) values ('pa_a','le_a','acct_AAA','v2','enabled'),('pa_b','le_b','acct_BBB','v2','onboarding');
insert into cp.stores(store_id, organisation_id, cell_id, region, lifecycle) values ('p_a2','o1','c3','eu-west-london','live');
insert into cp.store_payment_accounts(store_id, payment_account_id) values ('p_a','pa_a'),('p_b','pa_b');
do $$ begin
  begin insert into cp.payment_accounts(payment_account_id, entity_id, stripe_account_id, api_version, status) values ('pa_x','le_b','acct_AAA','v2','enabled'); raise exception 'one Stripe account recorded twice'; exception when unique_violation then null; end;
  begin insert into cp.payment_accounts(payment_account_id, entity_id, stripe_account_id, api_version, status) values ('pa_x','le_b','not-an-account','v2','enabled'); raise exception 'bad id'; exception when check_violation then null; end;
  begin insert into cp.legal_entities(entity_id, organisation_id, legal_name, company_number) values ('le_dup','o9','Dup','11111111'); raise exception 'same company registered twice'; exception when unique_violation then null; end;
  -- initial release: a second store cannot share a payment account, even within one organisation
  begin insert into cp.store_payment_accounts(store_id, payment_account_id) values ('p_a2','pa_a'); raise exception 'second store bound to the same account'; exception when unique_violation then if sqlerrm !~ 'one_store_per_payment_account' then raise; end if; end;
  -- and never across organisations
  begin insert into cp.store_payment_accounts(store_id, payment_account_id) values ('p_a2','pa_b'); raise exception 'cross-organisation binding'; exception when raise_exception then if sqlerrm !~ 'own organisation' then raise; end if; end;
end $$;
-- the data model can express multi-store sharing: lifting the one named constraint is all it takes, and isolation still holds
savepoint multi;
alter table cp.store_payment_accounts drop constraint one_store_per_payment_account;
insert into cp.store_payment_accounts(store_id, payment_account_id) values ('p_a2','pa_a');
do $$ begin
  begin insert into cp.store_payment_accounts(store_id, payment_account_id) values ('p_b','pa_a'); raise exception 'sharing leaked across organisations'; exception when raise_exception then if sqlerrm !~ 'own organisation' then raise; end if; end;
end $$;
set local role oss_runtime; select set_config('app.store_id','p_a2', true);
do $$ begin
  assert (select count(*) from cp.store_payment_accounts) = 1, 'the second store sees only its own binding, not its sibling''s';
  assert (select stripe_account_id from cp.payment_accounts) = 'acct_AAA', 'and can read the shared account';
  assert not exists (select 1 from cp.payment_accounts where stripe_account_id = 'acct_BBB'), 'but not another organisation''s account';
end $$;
reset role; rollback to savepoint multi;
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
