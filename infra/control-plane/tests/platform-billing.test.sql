-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region,lifecycle) values ('billing_test_a','org','cell','eu-west-london','ready'),('billing_test_b','org','cell','eu-west-london','ready');
insert into cp.platform_billing_accounts(store_id,stripe_customer_id,stripe_subscription_id) values ('billing_test_a','cus_test_a','sub_test_a'),('billing_test_b','cus_test_b','sub_test_b');
set local role oss_runtime;
select set_config('app.store_id','billing_test_a',true);
do $$ begin
  if (select count(*) from cp.platform_billing_accounts) <> 1 then raise exception 'billing account isolation failed'; end if;
  begin update cp.platform_billing_accounts set stripe_customer_id='cus_changed' where store_id='billing_test_a'; raise exception 'runtime changed platform billing binding'; exception when insufficient_privilege then null; end;
end $$;
rollback;
