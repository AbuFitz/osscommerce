-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region,lifecycle) values ('prefs_test_a','org','cell','eu-west-london','ready'),('prefs_test_b','org','cell','eu-west-london','ready');
set local role oss_runtime;
select set_config('app.store_id','prefs_test_a',true);
select cp.update_store_preferences('prefs_test_a',false,true,true,true,false,true);
do $$ begin
  if not (select checkout_paused and ask_marketing_consent and not show_sold_out from cp.store_preferences where store_id='prefs_test_a') then raise exception 'preferences were not stored'; end if;
  if exists(select 1 from cp.store_preferences where store_id='prefs_test_b') then raise exception 'cross-store preferences were visible'; end if;
  begin perform cp.update_store_preferences('prefs_test_b',true,true,true,false,true,false); raise exception 'cross-store update was accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
