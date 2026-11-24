-- Essential service email rules exist for every store and cannot be disabled.
create function cp.seed_default_email_rules(p_store_id text) returns void
language sql security definer set search_path = cp, pg_temp as $$
  insert into cp.automation_rules (id, store_id, name, trigger, kind, enabled, action)
  values
    (p_store_id || ':order_confirmation', p_store_id, 'Order confirmation', 'order.paid', 'transactional', true, '{"type":"send_email","template":"order_confirmation","to":"shopper"}'),
    (p_store_id || ':order_dispatched', p_store_id, 'Order dispatched', 'order.fulfilled', 'transactional', true, '{"type":"send_email","template":"order_dispatched","to":"shopper"}')
  on conflict (id) do nothing
$$;
revoke all on function cp.seed_default_email_rules(text) from public;

create function cp.seed_default_email_rules_on_store() returns trigger language plpgsql security definer set search_path = cp, pg_temp as $$
begin perform cp.seed_default_email_rules(new.store_id); return new; end $$;
create trigger stores_seed_default_email_rules after insert on cp.stores for each row execute function cp.seed_default_email_rules_on_store();

select cp.seed_default_email_rules(store_id) from cp.stores;
insert into cp.schema_migrations(version) values ('0011_default_email_rules') on conflict do nothing;
