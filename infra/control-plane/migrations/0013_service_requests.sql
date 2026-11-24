-- Merchant service requests and quote decisions. Runtime access is intentionally narrow:
-- merchants can read their own rows and may only create/decide through security-definer functions.
create table cp.service_requests (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references cp.stores on delete cascade,
  kind text not null check (kind in ('product_upload','design_change','content','integration','other')),
  title text not null check (char_length(title) between 4 and 160),
  detail text not null default '' check (char_length(detail) <= 5000),
  status text not null default 'submitted' check (status in ('submitted','quoted','in_progress','done','declined')),
  quote_minor integer check (quote_minor is null or quote_minor >= 0),
  quoted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'quoted' or quote_minor is not null)
);
create index service_requests_store_created on cp.service_requests(store_id, created_at desc);

alter table cp.service_requests enable row level security;
create policy service_request_scope on cp.service_requests for select to oss_runtime
  using (store_id = nullif(current_setting('app.store_id', true), ''));
grant select on cp.service_requests to oss_runtime;

create function cp.create_service_request(p_store text, p_kind text, p_title text, p_detail text) returns uuid
language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_id uuid;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode = '42501'; end if;
  if p_kind not in ('product_upload','design_change','content','integration','other') then raise exception 'invalid request kind'; end if;
  if char_length(btrim(p_title)) not between 4 and 160 then raise exception 'invalid request title'; end if;
  if char_length(coalesce(p_detail,'')) > 5000 then raise exception 'request detail is too long'; end if;
  insert into cp.service_requests(store_id,kind,title,detail) values (p_store,p_kind,btrim(p_title),btrim(coalesce(p_detail,''))) returning id into v_id;
  insert into cp.audit_log(store_id,actor,action,after) values (p_store,'merchant','service_request.created',jsonb_build_object('id',v_id,'kind',p_kind));
  return v_id;
end $$;

create function cp.decide_service_quote(p_store text, p_id uuid, p_approve boolean) returns table(status text, changed boolean)
language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_status text; v_quote integer;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode = '42501'; end if;
  update cp.service_requests set status=case when p_approve then 'in_progress' else 'declined' end, decided_at=now(), updated_at=now()
    where store_id=p_store and id=p_id and service_requests.status='quoted' returning service_requests.status, quote_minor into v_status, v_quote;
  if v_status is null then return query select null::text, false; return; end if;
  insert into cp.audit_log(store_id,actor,action,after) values (p_store,'merchant',case when p_approve then 'service_quote.approved' else 'service_quote.declined' end,jsonb_build_object('id',p_id,'status',v_status,'quote_minor',v_quote));
  return query select v_status, true;
end $$;

revoke all on function cp.create_service_request(text,text,text,text) from public;
revoke all on function cp.decide_service_quote(text,uuid,boolean) from public;
grant execute on function cp.create_service_request(text,text,text,text) to oss_runtime;
grant execute on function cp.decide_service_quote(text,uuid,boolean) to oss_runtime;

insert into cp.schema_migrations(version) values ('0013_service_requests') on conflict do nothing;
