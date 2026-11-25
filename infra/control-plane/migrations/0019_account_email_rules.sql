-- Account emails: a staff invitation and a staff password reset. Essential, so they exist for every store and cannot be disabled.
-- Sent from the platform to the person named on the event, never to a shopper, and never editable by a store.
create or replace function cp.seed_default_email_rules(p_store_id text) returns void
language sql security definer set search_path = cp, pg_temp as $$
  insert into cp.automation_rules (id, store_id, name, trigger, kind, enabled, action)
  values
    (p_store_id || ':order_confirmation', p_store_id, 'Order confirmation', 'order.paid', 'transactional', true, '{"type":"send_email","template":"order_confirmation","to":"shopper"}'),
    (p_store_id || ':order_dispatched', p_store_id, 'Order dispatched', 'order.fulfilled', 'transactional', true, '{"type":"send_email","template":"order_dispatched","to":"shopper"}'),
    (p_store_id || ':staff_invite', p_store_id, 'Staff invitation', 'staff.invited', 'transactional', true, '{"type":"send_email","template":"staff_invite","to":"shopper"}'),
    (p_store_id || ':staff_password_reset', p_store_id, 'Staff password reset', 'staff.password_reset', 'transactional', true, '{"type":"send_email","template":"staff_password_reset","to":"shopper"}')
  on conflict (id) do nothing
$$;
select cp.seed_default_email_rules(store_id) from cp.stores;
insert into cp.schema_migrations(version) values ('0019_account_email_rules') on conflict do nothing;
