-- Merchant launch requests are durable and tenant-scoped. Approval remains an operator action;
-- the portal may request review, but it cannot mark its own store live.
create table cp.store_launch_requests (
  store_id text primary key references cp.stores on delete cascade,
  state text not null default 'pending' check (state in ('pending','approved','declined','cancelled')),
  requested_by text not null, requested_at timestamptz not null default now(),
  decided_by text, decided_at timestamptz, note text,
  check ((decided_by is null) = (decided_at is null))
);

alter table cp.store_launch_requests enable row level security;
create policy store_scope on cp.store_launch_requests to oss_runtime
  using (store_id = nullif(current_setting('app.store_id', true), ''))
  with check (store_id = nullif(current_setting('app.store_id', true), ''));
grant select on cp.store_launch_requests to oss_runtime;

create function cp.request_store_launch(p_store text) returns boolean
language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_existing text;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode='42501'; end if;
  select state into v_existing from cp.store_launch_requests where store_id=p_store for update;
  if v_existing in ('pending','approved') then return false; end if;
  insert into cp.store_launch_requests(store_id,state,requested_by,requested_at,decided_by,decided_at,note)
  values(p_store,'pending','merchant',now(),null,null,null)
  on conflict(store_id) do update set state='pending',requested_by=excluded.requested_by,requested_at=excluded.requested_at,decided_by=null,decided_at=null,note=null;
  insert into cp.audit_log(store_id,actor,action,after) values(p_store,'merchant','storefront.launch_requested',jsonb_build_object('state','pending'));
  return true;
end $$;
revoke all on function cp.request_store_launch(text) from public;
grant execute on function cp.request_store_launch(text) to oss_runtime;

insert into cp.schema_migrations(version) values ('0015_launch_requests') on conflict do nothing;
