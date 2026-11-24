-- Run after migrations as the schema owner. Every assertion is rolled back.
begin;
insert into cp.stores(store_id,organisation_id,cell_id,region) values
  ('request_test_a','org_a','cell_a','eu-west-london'), ('request_test_b','org_b','cell_b','eu-west-london');
set local role oss_runtime;
select set_config('app.store_id','request_test_a',true);
select cp.create_service_request('request_test_a','design_change','New landing page','Please quote');

do $$ declare v_count integer; begin
  select count(*) into v_count from cp.service_requests; if v_count <> 1 then raise exception 'tenant cannot read its request'; end if;
  begin perform cp.create_service_request('request_test_b','other','Cross tenant','No'); raise exception 'scope mismatch was accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update cp.service_requests set status='quoted', quote_minor=12500, quoted_at=now() where title='New landing page';
set local role oss_runtime;
do $$ declare v_id uuid; v_changed boolean; begin
  select id into v_id from cp.service_requests where title='New landing page';
  select changed into v_changed from cp.decide_service_quote('request_test_a',v_id,true); if not v_changed then raise exception 'open quote was not approved'; end if;
  select changed into v_changed from cp.decide_service_quote('request_test_a',v_id,false); if v_changed then raise exception 'quote decision was not replay-safe'; end if;
end $$;
rollback;
