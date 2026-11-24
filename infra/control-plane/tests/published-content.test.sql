-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region,lifecycle) values ('content_test_a','org','cell','eu-west-london','live'),('content_test_b','org','cell','eu-west-london','live');
insert into cp.storefronts(storefront_id,store_id,name,env,state) values ('content_sf_a','content_test_a','A','production','live'),('content_sf_b','content_test_b','B','production','live');
set local role oss_runtime;
select set_config('app.store_id','content_test_a',true);
select * from cp.save_content_draft('content_test_a','legal/privacy','{"body":"A only"}'::jsonb,'merchant');
select * from cp.publish_content_entry('content_test_a','legal/privacy','merchant');

do $$ declare v_count integer; begin
  select count(*) into v_count from cp.get_published_content('content_sf_a','legal/privacy'); if v_count <> 1 then raise exception 'published content missing'; end if;
  select count(*) into v_count from cp.get_published_content('content_sf_b','legal/privacy'); if v_count <> 0 then raise exception 'content crossed storefronts'; end if;
  begin perform cp.save_content_draft('content_test_b','legal/privacy','{}'::jsonb,'merchant'); raise exception 'scope mismatch was accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
