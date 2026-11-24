-- Merchant preferences are tenant-scoped, audited and version storefront configuration.
-- Pausing checkout is also pushed to the cell's independently sourced merchant gate.
create table cp.store_preferences (
  store_id text primary key references cp.stores on delete cascade,
  low_stock_alert boolean not null default true,
  new_order_alert boolean not null default true,
  guest_checkout boolean not null default true,
  ask_marketing_consent boolean not null default false,
  show_sold_out boolean not null default true,
  checkout_paused boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into cp.store_preferences(store_id) select store_id from cp.stores on conflict do nothing;
create function cp.seed_store_preferences() returns trigger language plpgsql security definer set search_path = cp, pg_temp as $$
begin insert into cp.store_preferences(store_id) values(new.store_id) on conflict do nothing; return new; end $$;
create trigger stores_seed_preferences after insert on cp.stores for each row execute function cp.seed_store_preferences();

alter table cp.store_preferences enable row level security;
create policy store_scope on cp.store_preferences to oss_runtime
  using (store_id = nullif(current_setting('app.store_id', true), ''))
  with check (store_id = nullif(current_setting('app.store_id', true), ''));
grant select on cp.store_preferences to oss_runtime;

create function cp.update_store_preferences(
  p_store text, p_low_stock boolean, p_new_order boolean, p_guest boolean,
  p_consent boolean, p_show_sold_out boolean, p_paused boolean
) returns void language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode='42501'; end if;
  if p_low_stock is null or p_new_order is null or p_guest is null or p_consent is null or p_show_sold_out is null or p_paused is null then raise exception 'preferences must be booleans'; end if;
  select to_jsonb(p) - 'store_id' - 'updated_at' into v_before from cp.store_preferences p where store_id=p_store for update;
  if v_before is null then raise exception 'store preferences are not provisioned'; end if;
  update cp.store_preferences set low_stock_alert=p_low_stock,new_order_alert=p_new_order,guest_checkout=p_guest,
    ask_marketing_consent=p_consent,show_sold_out=p_show_sold_out,checkout_paused=p_paused,updated_at=now() where store_id=p_store;
  update cp.email_profiles set template_edits=jsonb_set(template_edits,'{notifications}',jsonb_build_object('newOrder',p_new_order,'lowStock',p_low_stock),true),updated_at=now() where store_id=p_store;
  update cp.storefronts set config_version=config_version+1,updated_at=now() where store_id=p_store and state not in ('disabled','retired');
  select to_jsonb(p) - 'store_id' - 'updated_at' into v_after from cp.store_preferences p where store_id=p_store;
  insert into cp.audit_log(store_id,actor,action,before,after) values(p_store,'merchant','store.preferences_updated',v_before,v_after);
end $$;
revoke all on function cp.update_store_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function cp.update_store_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) to oss_runtime;

-- Storefront servers read only their public behaviour flags. Authentication remains in the gateway;
-- this function deliberately returns no email-alert preferences or other merchant-private data.
create function cp.get_storefront_preferences(p_storefront text) returns table (
  config_version integer, guest_checkout boolean, ask_marketing_consent boolean,
  show_sold_out boolean, checkout_paused boolean
) language sql security definer set search_path = cp, pg_temp stable as $$
  select f.config_version,p.guest_checkout,p.ask_marketing_consent,p.show_sold_out,p.checkout_paused
  from cp.storefronts f join cp.store_preferences p using(store_id)
  where f.storefront_id=p_storefront and f.state in ('connected','approved','live')
$$;
revoke all on function cp.get_storefront_preferences(text) from public;
grant execute on function cp.get_storefront_preferences(text) to oss_runtime;

insert into cp.schema_migrations(version) values ('0016_store_preferences') on conflict do nothing;
