-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region,lifecycle) values ('domain_test_a','org','cell','eu-west-london','configuring'),('domain_test_b','org','cell','eu-west-london','configuring');
insert into cp.storefronts(storefront_id,store_id,name,env,state) values ('domain_sf_a','domain_test_a','A','production','connected'),('domain_sf_b','domain_test_b','B','production','connected');
insert into cp.storefront_hosts(host,storefront_id,store_id) values ('shop-a.example.com','domain_sf_a','domain_test_a'),('shop-b.example.com','domain_sf_b','domain_test_b');
set local role oss_runtime;
select set_config('app.store_id','domain_test_a',true);
do $$ begin
  begin update cp.storefront_hosts set verified=true where host='shop-a.example.com'; raise exception 'runtime directly changed verification'; exception when insufficient_privilege then null; end;
  if not cp.record_domain_verification('domain_test_a','shop-a.example.com') then raise exception 'own hostname was not verified'; end if;
  begin perform cp.record_domain_verification('domain_test_b','shop-b.example.com'); raise exception 'cross-store verification accepted'; exception when others then if sqlerrm not like '%store context mismatch%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if not (select verified from cp.storefront_hosts where host='shop-a.example.com') then raise exception 'storefront hostname not recorded'; end if;
  if not (select verified from cp.store_hostnames where host='shop-a.example.com') then raise exception 'routing hostname not recorded'; end if;
  if (select verified from cp.storefront_hosts where host='shop-b.example.com') then raise exception 'other hostname changed'; end if;
end $$;
rollback;
