-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region,lifecycle) values ('launch_test_a','org','cell','eu-west-london','ready'),('launch_test_b','org','cell','eu-west-london','ready');
set local role oss_runtime;
select set_config('app.store_id','launch_test_a',true);
do $$ begin
  if not cp.request_store_launch('launch_test_a') then raise exception 'first launch request was refused'; end if;
  if cp.request_store_launch('launch_test_a') then raise exception 'duplicate launch request was accepted'; end if;
  begin perform cp.request_store_launch('launch_test_b'); raise exception 'cross-store launch request was accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
